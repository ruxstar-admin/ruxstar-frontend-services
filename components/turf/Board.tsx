"use client";

import { memo, type KeyboardEvent } from "react";
import { Icon } from "@/components/ui";
import { money } from "@/lib/api/shops";
import type { Board as BoardData, BoardCourt, BoardSlot } from "@/lib/api/turf";
import { clockText, rangeText, slotLengthText } from "@/lib/turf";
import { LOOK, useStable } from "./booking";
import styles from "./turf.module.css";

const HALF = 30;
const minutes = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));

export type BoardLook = "free" | "peak" | "booked" | "arrived" | "held" | "blocked";

export function boardLook(slot: BoardSlot): BoardLook {
  if (slot.state === "booked") return slot.booking?.arrival === "arrived" ? "arrived" : "booked";
  if (slot.state === "held" || slot.state === "blocked") return slot.state;
  return slot.peak ? "peak" : "free";
}

/** What a cell says under its icon: the price when free, who booked it, or the block's note. */
function cellText(slot: BoardSlot): string {
  if (slot.state === "free") return money(slot.price);
  if (slot.state === "held") return "Paying";
  if (slot.state === "blocked") return slot.block?.note || "Blocked";
  if (slot.booking?.arrival === "no_show") return "No-show";
  return slot.booking?.customerName.split(" ")[0] ?? "Booked";
}

/** Free slots that have passed can't be blocked or booked, so they do nothing. */
export const tappable = (slot: BoardSlot) => !slot.past || slot.state === "booked" || slot.state === "held";

const Cell = memo(function Cell({
  court,
  slot,
  row,
  column,
  span,
  selected,
  onTap,
}: {
  court: BoardCourt;
  slot: BoardSlot;
  row: number;
  column: number;
  span: number;
  selected: boolean;
  onTap: (courtId: string, slot: BoardSlot) => void;
}) {
  const look = boardLook(slot);
  const text = cellText(slot);
  const active = tappable(slot);
  const detail = slot.state === "free" ? `, ${money(slot.price)}${slot.peak ? ", peak" : ""}` : slot.state === "held" ? "" : `, ${text}`;
  return (
    <button
      type="button"
      data-cell
      data-row={row}
      data-col={column}
      className={styles.cell}
      data-state={look}
      data-past={slot.past || undefined}
      style={{ gridRow: row, gridColumn: `${column} / span ${span}` }}
      aria-pressed={active ? selected : undefined}
      aria-disabled={!active || undefined}
      aria-label={`${court.name}, ${rangeText(slot.start, slot.end)}, ${LOOK[look].label}${detail}${slot.past ? ", past" : ""}`}
      onClick={() => active && onTap(court.id, slot)}
    >
      <Icon name={LOOK[look].icon} size={14} />
      <span>{text}</span>
    </button>
  );
});

/** Left and right walk the cells in order; up and down go to the nearest cell in the next court that has any. */
function onBoardKeys(e: KeyboardEvent<HTMLDivElement>) {
  const current = document.activeElement as HTMLElement | null;
  if (!current?.dataset.cell) return;
  const cells = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("button[data-cell]")];
  const at = cells.indexOf(current as HTMLButtonElement);
  const row = Number(current.dataset.row);
  const col = Number(current.dataset.col);
  let next: HTMLButtonElement | undefined;
  if (e.key === "ArrowRight") next = cells[at + 1];
  else if (e.key === "ArrowLeft") next = cells[at - 1];
  else if (e.key === "Home") next = cells.find((c) => Number(c.dataset.row) === row);
  else if (e.key === "End") next = cells.filter((c) => Number(c.dataset.row) === row).at(-1);
  else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    const step = e.key === "ArrowDown" ? 1 : -1;
    const rows = new Set(cells.map((c) => Number(c.dataset.row)));
    let target = row + step;
    while (!rows.has(target) && target > 1 && target < 1000) target += step;
    const inRow = cells.filter((c) => Number(c.dataset.row) === target);
    next = inRow.reduce<HTMLButtonElement | undefined>((best, c) => (!best || Math.abs(Number(c.dataset.col) - col) < Math.abs(Number(best.dataset.col) - col) ? c : best), undefined);
  } else return;
  if (!next) return;
  e.preventDefault();
  next.focus();
}

/**
 * One day of a ground: courts down the side, half hours across, so courts with different slot lengths line up. Each
 * slot is one button spanning its half hours. Cells only redraw when their own slot or selection changes.
 */
export function Board({
  board,
  isSelected,
  onTap,
}: {
  board: BoardData;
  isSelected: (courtId: string, slot: BoardSlot) => boolean;
  onTap: (courtId: string, slot: BoardSlot) => void;
}) {
  const tap = useStable(onTap);
  const slots = board.courts.flatMap((c) => c.slots);
  const first = slots.length ? Math.min(...slots.map((s) => minutes(s.start))) : 6 * 60;
  const last = slots.length ? Math.max(...slots.map((s) => minutes(s.end === "00:00" ? "24:00" : s.end))) : 22 * 60;
  const start = Math.floor(first / 60) * 60;
  const columns = Math.max(1, Math.ceil((last - start) / HALF));
  const heads = Array.from({ length: columns }, (_, i) => start + i * HALF);

  if (!board.courts.length) return <p className={styles.slotPrice}>This ground has no courts yet.</p>;

  return (
    <div className={styles.boardWrap} tabIndex={-1}>
      <div
        className={styles.board}
        role="group"
        aria-label="Courts and times. Use the arrow keys to move between slots."
        style={{ gridTemplateColumns: `112px repeat(${columns}, 64px)` }}
        onKeyDown={onBoardKeys}
      >
        <span className={styles.corner} style={{ gridRow: 1, gridColumn: 1 }}>
          Court
        </span>
        {heads.map((m, i) => (
          <span key={m} className={styles.colHead} style={{ gridRow: 1, gridColumn: i + 2 }} aria-hidden>
            {m % 60 === 0 ? clockText(`${String(m / 60).padStart(2, "0")}:00`) : ":30"}
          </span>
        ))}
        {board.courts.map((court, r) => (
          <CourtRow key={court.id} court={court} row={r + 2} start={start} columns={columns} isSelected={isSelected} onTap={tap} />
        ))}
      </div>
    </div>
  );
}

function CourtRow({
  court,
  row,
  start,
  columns,
  isSelected,
  onTap,
}: {
  court: BoardCourt;
  row: number;
  start: number;
  columns: number;
  isSelected: (courtId: string, slot: BoardSlot) => boolean;
  onTap: (courtId: string, slot: BoardSlot) => void;
}) {
  const shut = !court.slots.length;
  return (
    <>
      <span className={styles.rowHead} style={{ gridRow: row, gridColumn: 1 }}>
        <strong>{court.name}</strong>
        <span>{court.status === "paused" ? "Paused" : slotLengthText(court.slotMinutes)}</span>
      </span>
      {shut ? (
        <span className={styles.closed} style={{ gridRow: row, gridColumn: `2 / span ${columns}` }}>
          {court.status === "paused" ? "Not taking bookings" : "Closed this day"}
        </span>
      ) : (
        court.slots.map((slot) => {
          const from = minutes(slot.start);
          const to = minutes(slot.end === "00:00" ? "24:00" : slot.end);
          return (
            <Cell
              key={slot.startAt}
              court={court}
              slot={slot}
              row={row}
              column={2 + (from - start) / HALF}
              span={Math.max(1, (to - from) / HALF)}
              selected={isSelected(court.id, slot)}
              onTap={onTap}
            />
          );
        })
      )}
    </>
  );
}
