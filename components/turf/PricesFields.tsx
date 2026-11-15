"use client";

import { Button, Icon, Input } from "@/components/ui";
import type { AddOnInput, AddOnPer, CourtView, Hours, Prices, TurfRulesView } from "@/lib/api/turf";
import { DAY_SHORT, HALF_HOURS, paiseOf, PER_LABEL, WEEK } from "@/lib/turf";
import vendor from "@/components/vendor/vendor.module.css";
import styles from "./turf.module.css";

export interface PeakDraft {
  key: number;
  days: number[];
  start: string;
  end: string;
  price: string;
}
export interface AddOnDraft {
  key: number;
  id?: string;
  name: string;
  price: string;
  per: AddOnPer;
}
export interface PricesDraft {
  base: string;
  weekend: string;
  peaks: PeakDraft[];
  addOns: AddOnDraft[];
}

const MAX_PEAKS = 5;
let keys = 0;
const rupees = (paise: number) => (paise % 100 ? (paise / 100).toFixed(2) : String(paise / 100));
const minutes = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));
const endMinutes = (clock: string) => (clock === "00:00" ? 24 * 60 : minutes(clock));

export function pricesDraftOf(court?: Pick<CourtView, "prices" | "addOns">): PricesDraft {
  return {
    base: court ? rupees(court.prices.base) : "",
    weekend: court?.prices.weekend ? rupees(court.prices.weekend) : "",
    peaks: (court?.prices.peak ?? []).map((p) => ({ key: keys++, days: p.days, start: p.start, end: p.end, price: rupees(p.price) })),
    addOns: (court?.addOns ?? []).map((a) => ({ key: keys++, id: a.id, name: a.name, price: rupees(a.price), per: a.per })),
  };
}

/** What's wrong with the prices, by field. Every slot costs at least ₹1. */
export function pricesErrors(d: PricesDraft, rules: Pick<TurfRulesView, "maxAddOns">): Record<string, string> {
  const e: Record<string, string> = {};
  const price = (text: string) => {
    const p = paiseOf(text);
    return p !== null && p >= 100 && p <= 1_00_000_00 ? p : null;
  };
  if (price(d.base) === null) e.base = "At least ₹1 a slot";
  if (d.weekend.trim() && price(d.weekend) === null) e.weekend = "At least ₹1, or empty for the base price";
  if (d.peaks.length > MAX_PEAKS) e.peaks = `Up to ${MAX_PEAKS} peak windows`;
  d.peaks.forEach((p, i) => {
    if (!p.days.length) e[`peak${i}.days`] = "Pick at least one day";
    if (endMinutes(p.end) <= minutes(p.start)) e[`peak${i}.end`] = "It must end after it starts";
    if (price(p.price) === null) e[`peak${i}.price`] = "At least ₹1 a slot";
    d.peaks.slice(0, i).forEach((q) => {
      const sameDay = p.days.some((day) => q.days.includes(day));
      if (sameDay && minutes(p.start) < endMinutes(q.end) && minutes(q.start) < endMinutes(p.end)) e[`peak${i}.end`] = "Overlaps another peak window on the same day";
    });
  });
  if (d.addOns.length > rules.maxAddOns) e.addOns = `Up to ${rules.maxAddOns} add-ons`;
  const names = new Set<string>();
  d.addOns.forEach((a, i) => {
    const name = a.name.trim().toLowerCase();
    if (name.length < 2) e[`addOn${i}.name`] = "Name it, like Bibs or Ball";
    else if (names.has(name)) e[`addOn${i}.name`] = "Each add-on needs its own name";
    names.add(name);
    const p = paiseOf(a.price);
    if (p === null || p > 1_00_000_00) e[`addOn${i}.price`] = "Rupees, or 0 for free";
  });
  return e;
}

export function pricesOf(d: PricesDraft): { prices: Prices; addOns: AddOnInput[] } {
  return {
    prices: {
      base: paiseOf(d.base) ?? 0,
      weekend: d.weekend.trim() ? (paiseOf(d.weekend) ?? null) : null,
      peak: d.peaks.map((p) => ({ days: [...p.days].sort((a, b) => a - b), start: p.start, end: p.end, price: paiseOf(p.price) ?? 0 })),
    },
    addOns: d.addOns.map((a) => ({ ...(a.id ? { id: a.id } : {}), name: a.name.trim(), price: paiseOf(a.price) ?? 0, per: a.per })),
  };
}

/** Each hour's price, Monday to Sunday: what a slot starting then costs. Peak beats weekend, weekend beats base. */
function PricePreview({ draft, hours }: { draft: PricesDraft; hours: Hours[] }) {
  const open = hours.length ? Math.min(...hours.map((h) => minutes(h.open))) : 6 * 60;
  const close = hours.length ? Math.max(...hours.map((h) => endMinutes(h.close))) : 23 * 60;
  const rows: number[] = [];
  for (let m = Math.floor(open / 60) * 60; m < close; m += 60) rows.push(m);
  const { prices } = pricesOf(draft);
  const cell = (day: number, start: number) => {
    const h = hours.find((x) => x.day === day);
    if (hours.length && (!h || start < minutes(h.open) || start >= endMinutes(h.close))) return { kind: "closed", text: "" };
    const peak = prices.peak.find((p) => p.days.includes(day) && minutes(p.start) <= start && start < endMinutes(p.end));
    if (peak) return { kind: "peak", text: String(Math.round(peak.price / 100)) };
    if ((day === 0 || day === 6) && prices.weekend !== null) return { kind: "weekend", text: String(Math.round(prices.weekend / 100)) };
    return { kind: "base", text: prices.base ? String(Math.round(prices.base / 100)) : "" };
  };
  return (
    <div className={styles.preview} aria-hidden>
      <span />
      {WEEK.map((d) => (
        <span key={d}>{DAY_SHORT[d]}</span>
      ))}
      {rows.map((m) => (
        <PreviewRow key={m} start={m} cell={cell} />
      ))}
    </div>
  );
}

function PreviewRow({ start, cell }: { start: number; cell: (day: number, start: number) => { kind: string; text: string } }) {
  const label = HALF_HOURS[start / 30]?.label ?? "";
  return (
    <>
      <span>{label.replace(":00", "")}</span>
      {WEEK.map((d) => {
        const c = cell(d, start);
        return (
          <span key={d} data-kind={c.kind}>
            {c.text}
          </span>
        );
      })}
    </>
  );
}

/** Base, weekend and peak prices, and add-ons. Shared by the court form and the team's prices page. */
export function PricesFields({
  draft,
  onChange,
  errors,
  rules,
  hours,
  slotMinutes,
}: {
  draft: PricesDraft;
  onChange: (next: PricesDraft) => void;
  errors: Record<string, string | undefined>;
  rules: Pick<TurfRulesView, "maxAddOns">;
  hours: Hours[];
  slotMinutes: number;
}) {
  const set = <K extends keyof PricesDraft>(key: K, value: PricesDraft[K]) => onChange({ ...draft, [key]: value });
  const setPeak = (i: number, next: Partial<PeakDraft>) => set("peaks", draft.peaks.map((p, j) => (j === i ? { ...p, ...next } : p)));
  const setAddOn = (i: number, next: Partial<AddOnDraft>) => set("addOns", draft.addOns.map((a, j) => (j === i ? { ...a, ...next } : a)));

  return (
    <>
      <div className={vendor.pair} data-even>
        <Input label={`Price per ${slotMinutes} min slot (₹)`} inputMode="decimal" value={draft.base} onChange={(e) => set("base", e.target.value)} error={errors.base} />
        <Input
          label="Saturday and Sunday (₹, optional)"
          inputMode="decimal"
          value={draft.weekend}
          onChange={(e) => set("weekend", e.target.value)}
          hint="Empty for the same price"
          error={errors.weekend}
        />
      </div>

      <div className={vendor.field}>
        <div className={vendor.spread}>
          <span className={vendor.label}>Peak hours</span>
          {draft.peaks.length < MAX_PEAKS && (
            <Button
              type="button"
              variant="ghost"
              icon={<Icon name="plus" size={16} />}
              onClick={() => set("peaks", [...draft.peaks, { key: keys++, days: [1, 2, 3, 4, 5], start: "18:00", end: "22:00", price: draft.base }])}
            >
              Add peak hours
            </Button>
          )}
        </div>
        <p className={vendor.faint}>A slot starting inside a peak window costs its peak price, even at the weekend.</p>
        {errors.peaks && (
          <p className={vendor.error} role="alert">
            {errors.peaks}
          </p>
        )}
        {draft.peaks.map((p, i) => (
          <fieldset key={p.key} className={styles.peak}>
            <legend className={vendor.label}>{`Peak window ${i + 1}`}</legend>
            <div className={styles.peakDays} role="group" aria-label="Days">
              {WEEK.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={vendor.chip}
                  aria-pressed={p.days.includes(d)}
                  onClick={() => setPeak(i, { days: p.days.includes(d) ? p.days.filter((x) => x !== d) : [...p.days, d] })}
                >
                  {DAY_SHORT[d]}
                </button>
              ))}
            </div>
            {errors[`peak${i}.days`] && <p className={vendor.error}>{errors[`peak${i}.days`]}</p>}
            <div className={styles.peakTimes}>
              <label className={vendor.field}>
                <span className={vendor.label}>From</span>
                <select className={vendor.select} value={p.start} onChange={(e) => setPeak(i, { start: e.target.value })}>
                  {HALF_HOURS.slice(0, 48).map((h) => (
                    <option key={h.value} value={h.value}>
                      {h.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={vendor.field}>
                <span className={vendor.label}>Until</span>
                <select className={vendor.select} value={p.end === "00:00" ? "24:00" : p.end} onChange={(e) => setPeak(i, { end: e.target.value })}>
                  {HALF_HOURS.slice(1).map((h) => (
                    <option key={h.value} value={h.value}>
                      {h.label}
                    </option>
                  ))}
                </select>
              </label>
              <Input label="Peak price (₹)" inputMode="decimal" value={p.price} onChange={(e) => setPeak(i, { price: e.target.value })} error={errors[`peak${i}.price`]} />
            </div>
            {errors[`peak${i}.end`] && <p className={vendor.error}>{errors[`peak${i}.end`]}</p>}
            <div>
              <button type="button" className={vendor.link} data-muted onClick={() => set("peaks", draft.peaks.filter((_, j) => j !== i))}>
                Remove this window
              </button>
            </div>
          </fieldset>
        ))}
      </div>

      <div className={vendor.field}>
        <span className={vendor.label}>Price for each hour</span>
        <PricePreview draft={draft} hours={hours} />
        <p className={vendor.faint}>Rupees for a slot starting at that hour. Blue is peak, tinted is the weekend price, blank is closed.</p>
      </div>

      <div className={vendor.field}>
        <div className={vendor.spread}>
          <span className={vendor.label}>Add-ons</span>
          {draft.addOns.length < rules.maxAddOns && (
            <Button type="button" variant="ghost" icon={<Icon name="plus" size={16} />} onClick={() => set("addOns", [...draft.addOns, { key: keys++, name: "", price: "", per: "booking" }])}>
              Add an add-on
            </Button>
          )}
        </div>
        <p className={vendor.faint}>Things players can add when booking, like bibs, a ball or a referee.</p>
        {errors.addOns && (
          <p className={vendor.error} role="alert">
            {errors.addOns}
          </p>
        )}
        {draft.addOns.map((a, i) => (
          <fieldset key={a.key} className={styles.peak}>
            <legend className={vendor.label}>{a.name.trim() || `Add-on ${i + 1}`}</legend>
            <div className={vendor.pair} data-even>
              <Input label="Name" value={a.name} onChange={(e) => setAddOn(i, { name: e.target.value })} maxLength={40} error={errors[`addOn${i}.name`]} />
              <Input label="Price (₹)" inputMode="decimal" value={a.price} onChange={(e) => setAddOn(i, { price: e.target.value })} hint="0 for free" error={errors[`addOn${i}.price`]} />
            </div>
            <div className={vendor.chips} role="radiogroup" aria-label="Charged">
              {(["booking", "slot"] as const).map((per) => (
                <button key={per} type="button" role="radio" className={vendor.chip} aria-checked={a.per === per} aria-pressed={a.per === per} onClick={() => setAddOn(i, { per })}>
                  {PER_LABEL[per].replace(/^per /, "Per ")}
                </button>
              ))}
            </div>
            <div>
              <button type="button" className={vendor.link} data-muted onClick={() => set("addOns", draft.addOns.filter((_, j) => j !== i))}>
                Remove this add-on
              </button>
            </div>
          </fieldset>
        ))}
      </div>
    </>
  );
}
