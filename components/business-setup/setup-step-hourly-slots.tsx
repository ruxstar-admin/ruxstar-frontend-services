"use client";

import type { WeeklyHours } from "@/lib/api";
import {
  DAY_LABELS,
  DAY_SHORT,
  SETUP_DAYS,
  SLOT_MINUTES_OPTIONS,
} from "@/lib/business-setup";

const input = "field-input";

type Props = {
  intro: string;
  weeklyHours: WeeklyHours;
  slotMinutes: number;
  hoursRefDay: (typeof SETUP_DAYS)[number];
  hideSlotLength?: boolean;
  onSlotMinutesChange: (m: number) => void;
  onToggleDay: (day: (typeof SETUP_DAYS)[number]) => void;
  onUniformHours: (open: string, close: string) => void;
};

export function SetupStepHourlySlots({
  intro,
  weeklyHours,
  slotMinutes,
  hoursRefDay,
  hideSlotLength = false,
  onSlotMinutesChange,
  onToggleDay,
  onUniformHours,
}: Props) {
  return (
    <div className="space-y-4">
      {intro ? <p className="text-sm text-zinc-400">{intro}</p> : null}
      {!hideSlotLength && (
        <div className="max-w-xs">
          <select
            className={`${input} w-full py-2 text-sm`}
            value={slotMinutes}
            onChange={(e) => onSlotMinutesChange(Number(e.target.value))}
          >
            {SLOT_MINUTES_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m} min slots
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          type="time"
          value={weeklyHours[hoursRefDay].open}
          className={`${input} flex-1 py-2 text-sm`}
          onChange={(e) => onUniformHours(e.target.value, weeklyHours[hoursRefDay].close)}
        />
        <span className="text-xs text-zinc-600">to</span>
        <input
          type="time"
          value={weeklyHours[hoursRefDay].close}
          className={`${input} flex-1 py-2 text-sm`}
          onChange={(e) => onUniformHours(weeklyHours[hoursRefDay].open, e.target.value)}
        />
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {SETUP_DAYS.map((day) => {
          const open = !weeklyHours[day].closed;
          return (
            <button
              key={day}
              type="button"
              title={DAY_LABELS[day]}
              onClick={() => onToggleDay(day)}
              className={`rounded-lg py-2 text-xs font-medium transition ${
                open
                  ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40"
                  : "bg-white/5 text-zinc-600 ring-1 ring-white/5"
              }`}
            >
              {DAY_SHORT[day]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
