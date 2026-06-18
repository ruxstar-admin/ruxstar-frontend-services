"use client";

import {
  addDays,
  canGoNextRange,
  canGoPrevRange,
  clampRangeStart,
  formatRangeLabel,
  shiftRangeStart,
  todayLocal,
} from "@/lib/date-utils";

type Props = {
  rangeStart: string;
  rangeEnd: string;
  onRangeStartChange: (start: string) => void;
};

export function SlotDateNav({ rangeStart, rangeEnd, onRangeStartChange }: Props) {
  const today = todayLocal();
  const prevDisabled = !canGoPrevRange(rangeStart);
  const nextDisabled = !canGoNextRange(rangeStart);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={prevDisabled}
        onClick={() => onRangeStartChange(shiftRangeStart(rangeStart, -1))}
        className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
      >
        ← Prev
      </button>
      <p className="min-w-0 flex-1 truncate text-center text-xs font-medium text-zinc-300">
        {formatRangeLabel(rangeStart, rangeEnd)}
      </p>
      <button
        type="button"
        disabled={nextDisabled}
        onClick={() => onRangeStartChange(shiftRangeStart(rangeStart, 1))}
        className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Next →
      </button>
      <button
        type="button"
        onClick={() => onRangeStartChange(today)}
        className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-400 hover:bg-white/5"
      >
        Today
      </button>
    </div>
  );
}
