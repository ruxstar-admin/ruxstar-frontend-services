"use client";

import { Fragment } from "react";
import type { Slot } from "@/lib/api/coaching";
import { DAY_LONG, DAY_SHORT, minutesOf, startOf, WEEK } from "@/lib/coaching";
import styles from "./coaching.module.css";

/** The grid shows 6 am to 10 pm in half hours; the slot list below it takes any 15-minute start. */
const FIRST = 6 * 60;
const LAST = 22 * 60;
const STEP = 30;
const ROWS = Array.from({ length: (LAST - FIRST) / STEP }, (_, i) => FIRST + i * STEP);

const hourLabel = (m: number) => {
  const h = Math.floor(m / 60);
  return `${h % 12 || 12} ${h < 12 ? "am" : "pm"}`;
};
const clock = (m: number) => {
  const h = Math.floor(m / 60);
  return `${h % 12 || 12}:${String(m % 60).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};

/**
 * A week as days across and times down. Tapping an empty half hour adds a class there for `minutes`; tapping a class
 * removes it. Pure CSS grid, no library.
 */
export function WeekGrid({ slots, minutes, onChange, disabled }: { slots: Slot[]; minutes: number; onChange: (slots: Slot[]) => void; disabled?: boolean }) {
  const slotAt = (day: number, m: number) =>
    slots.findIndex((s) => s.day === day && minutesOf(s.start) < m + STEP && m < minutesOf(s.start) + s.minutes);
  const startsIn = (s: Slot, m: number) => minutesOf(s.start) >= m && minutesOf(s.start) < m + STEP;

  const tap = (day: number, m: number) => {
    const at = slotAt(day, m);
    if (at >= 0) onChange(slots.filter((_, i) => i !== at));
    else onChange([...slots, { day, start: startOf(m), minutes }]);
  };

  return (
    <div className={styles.gridWrap}>
      <div className={styles.grid} role="group" aria-label="Weekly timetable">
        <span className={styles.gridHead} aria-hidden />
        {WEEK.map((d) => (
          <span key={d} className={styles.gridHead} aria-hidden>
            {DAY_SHORT[d]}
          </span>
        ))}
        {ROWS.map((m) => (
          <Fragment key={m}>
            <span className={styles.gridTime} aria-hidden>
              {m % 60 === 0 ? hourLabel(m) : ""}
            </span>
            {WEEK.map((d) => {
              const at = slotAt(d, m);
              const slot = at >= 0 ? slots[at]! : null;
              const start = !!slot && startsIn(slot, m);
              return (
                <button
                  key={d}
                  type="button"
                  className={styles.cell}
                  data-hour={m % 60 === 0}
                  data-covered={(slot && !start) || undefined}
                  aria-pressed={start}
                  aria-label={`${DAY_LONG[d]} ${clock(m)}${slot ? ", class here. Tap to remove" : ""}`}
                  disabled={disabled}
                  onClick={() => tap(d, m)}
                />
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
