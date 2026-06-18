"use client";

import type { WeeklyHours } from "@/lib/api";
import { DAY_LABELS, DAY_SHORT, SETUP_DAYS } from "@/lib/business-setup";

type Props = {
  intro: string;
  weeklyHours: WeeklyHours;
  onToggleDay: (day: (typeof SETUP_DAYS)[number]) => void;
};

export function SetupStepFullDayDays({ intro, weeklyHours, onToggleDay }: Props) {
  return (
    <div className="space-y-4">
      {intro ? <p className="text-sm text-zinc-400">{intro}</p> : null}
      <div>
        <p className="mb-2 text-xs text-zinc-500">Open days</p>
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
                    ? "bg-violet-500/20 text-violet-200 ring-1 ring-violet-500/40"
                    : "bg-white/5 text-zinc-600 ring-1 ring-white/5"
                }`}
              >
                {DAY_SHORT[day]}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
