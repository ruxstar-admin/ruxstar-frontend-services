"use client";

import { memo, useCallback, useEffect, useRef, type KeyboardEvent } from "react";
import { Icon, type IconName } from "@/components/ui";
import { money } from "@/lib/api/shops";
import { dayLong, rangeText, type PickSlot, type SlotLook, type StripDay } from "@/lib/turf";
import order from "@/components/shop/order.module.css";
import styles from "./turf.module.css";

/** How each cell looks. Every state has its own icon, so colour is never the only signal. Same as the app. */
export const LOOK: Record<SlotLook | "selected" | "held" | "arrived", { label: string; icon: IconName }> = {
  free: { label: "Free", icon: "plus" },
  peak: { label: "Peak", icon: "flame" },
  selected: { label: "Selected", icon: "check" },
  booked: { label: "Booked", icon: "close" },
  held: { label: "Being paid for", icon: "clock" },
  blocked: { label: "Blocked", icon: "lock" },
  arrived: { label: "Arrived", icon: "verified" },
};

/** A callback that keeps one identity, so memoised cells don't redraw when the parent does. */
export function useStable<A extends unknown[]>(fn: (...args: A) => void) {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  return useCallback((...args: A) => ref.current(...args), []);
}

/** Arrow keys move between the buttons of a grid; up and down jump a row of `columns()`. */
export function arrowKeys(columns: (el: HTMLElement) => number) {
  return (e: KeyboardEvent<HTMLElement>) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : e.key === "ArrowDown" ? columns(e.currentTarget) : e.key === "ArrowUp" ? -columns(e.currentTarget) : 0;
    if (!step) return;
    const buttons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("button[data-cell]")];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = buttons[at + step];
    if (at < 0 || !next) return;
    e.preventDefault();
    next.focus();
  };
}
const gridColumns = (el: HTMLElement) => getComputedStyle(el).gridTemplateColumns.split(" ").filter(Boolean).length || 1;

/** The next 14 days. Closed days stay in the row, struck through, so the dates don't jump. */
export function DateStrip({ days, value, onChange, note }: { days: StripDay[]; value: string; onChange: (day: string) => void; note?: (day: StripDay) => string | null }) {
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    list.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [value]);
  return (
    <ul ref={list} className={styles.strip} aria-label="Date">
      {days.map((d) => {
        const extra = note?.(d) ?? null;
        return (
          <li key={d.key}>
            <button
              type="button"
              className={styles.day}
              aria-pressed={d.key === value}
              data-closed={d.closed || undefined}
              aria-label={`${dayLong(d.key)}${d.closed ? ", closed" : ""}${extra ? `, ${extra}` : ""}`}
              onClick={() => onChange(d.key)}
            >
              {d.label}
              <small>{d.closed ? "Closed" : (extra ?? dayLong(d.key).split(" ").slice(1).join(" "))}</small>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

const SlotCell = memo(function SlotCell({ slot, selected, onPick }: { slot: PickSlot; selected: boolean; onPick: (key: string) => void }) {
  const pickable = slot.state === "free" || slot.state === "peak";
  const look = LOOK[selected ? "selected" : slot.state];
  const range = rangeText(slot.start, slot.end);
  const label = `${range}, ${pickable ? money(slot.price) : LOOK[slot.state].label}${slot.state === "peak" ? ", peak" : ""}${selected ? ", selected" : ""}`;
  return (
    <li>
      <button
        type="button"
        data-cell
        className={styles.slot}
        data-state={slot.state}
        aria-pressed={pickable ? selected : undefined}
        aria-disabled={!pickable || undefined}
        aria-label={label}
        title={pickable ? (selected ? "Removes this slot" : "Picks this slot") : LOOK[slot.state].label}
        onClick={() => pickable && onPick(slot.key)}
      >
        <span className={styles.slotTime}>{range}</span>
        <span className={styles.slotPrice}>{slot.state === "blocked" ? "Not available" : money(slot.price)}</span>
        <span className={styles.slotIcon}>
          <Icon name={look.icon} size={14} />
        </span>
      </button>
    </li>
  );
});

/**
 * A court's slots on one day. Tapping slots next to each other picks them together; see `toggleSlot`. Cells only redraw
 * when their own slot or selection changes.
 */
export function SlotGrid({ slots, selected, onPick }: { slots: PickSlot[]; selected: readonly string[]; onPick: (key: string) => void }) {
  const pick = useStable(onPick);
  if (!slots.length) return <p className={styles.slotPrice}>No slots on this day. Try another date.</p>;
  return (
    <ul className={styles.slots} aria-label="Slots" onKeyDown={arrowKeys(gridColumns)}>
      {slots.map((s) => (
        <SlotCell key={s.key} slot={s} selected={selected.includes(s.key)} onPick={pick} />
      ))}
    </ul>
  );
}

/** What each look means, with the same icons as the cells. */
export function Legend({ states }: { states: (keyof typeof LOOK)[] }) {
  return (
    <ul className={styles.legend} aria-label="What the colours mean">
      {states.map((s) => (
        <li key={s}>
          <span className={styles.swatch} data-state={s} aria-hidden>
            <Icon name={LOOK[s].icon} size={12} />
          </span>
          {LOOK[s].label}
        </li>
      ))}
    </ul>
  );
}

export function PriceLine({ label, amount, strong, minus }: { label: string; amount: number; strong?: boolean; minus?: boolean }) {
  return (
    <div className={strong ? `${order.priceRow} ${order.total}` : order.priceRow}>
      <dt>{label}</dt>
      <dd>{`${minus ? "− " : ""}${money(amount)}`}</dd>
    </div>
  );
}

/** A − count + control, for add-ons and weeks. */
export function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (n: number) => void; label: string }) {
  return (
    <span className={styles.stepper} role="group" aria-label={label}>
      <button type="button" className={styles.step} disabled={value <= min} aria-label={`Fewer ${label}`} onClick={() => onChange(value - 1)}>
        <Icon name="minus" size={16} />
      </button>
      <output aria-live="polite">{value}</output>
      <button type="button" className={styles.step} disabled={value >= max} aria-label={`More ${label}`} onClick={() => onChange(value + 1)}>
        <Icon name="plus" size={16} />
      </button>
    </span>
  );
}
