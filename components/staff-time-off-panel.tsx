"use client";

import { useCallback, useEffect, useState } from "react";
import {
  blockBusinessSlot,
  listStaffBlocks,
  unblockBusinessSlot,
  type BusinessStaff,
  type StaffBlock,
} from "@/lib/api";
import { formatDayLabel, formatTime12, todayLocal } from "@/lib/date-utils";

type Props = { businessId: string };

const input = "field-input h-9 py-0 text-sm";

/**
 * Staff time off for service businesses. Their slots are generated from opening
 * hours rather than a fixed grid, so a vendor blocks a date + time range for one
 * staff member and the availability builder skips it.
 */
export function StaffTimeOffPanel({ businessId }: Props) {
  const [blocks, setBlocks] = useState<StaffBlock[]>([]);
  const [staff, setStaff] = useState<BusinessStaff[]>([]);
  const [staffId, setStaffId] = useState("");
  const [date, setDate] = useState(todayLocal());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await listStaffBlocks(businessId);
      setBlocks(data.blocks);
      setStaff(data.staff);
      setStaffId((current) => current || data.staff[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load time off.");
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onAdd() {
    if (!staffId) return;
    if (endTime <= startTime) {
      setError("End time must be after the start time.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await blockBusinessSlot(businessId, {
        resourceId: staffId,
        startAt: `${date}T${startTime}:00+05:30`,
        endAt: `${date}T${endTime}:00+05:30`,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not block that time.");
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(block: StaffBlock) {
    setBusy(true);
    setError("");
    try {
      await unblockBusinessSlot(businessId, {
        resourceId: block.staffId,
        startAt: block.startAt,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove that block.");
    } finally {
      setBusy(false);
    }
  }

  if (!staff.length) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Staff time off</p>
      <p className="mt-0.5 text-xs text-zinc-500">
        Block a window when someone is unavailable — customers cannot book it.
      </p>

      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="text-[11px] text-zinc-500">Staff</span>
          <select
            className={`${input} mt-1 w-36`}
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
          >
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] text-zinc-500">Date</span>
          <input
            type="date"
            className={`${input} mt-1 w-36`}
            value={date}
            min={todayLocal()}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-[11px] text-zinc-500">From</span>
          <input
            type="time"
            className={`${input} mt-1 w-28`}
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-[11px] text-zinc-500">To</span>
          <input
            type="time"
            className={`${input} mt-1 w-28`}
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={() => void onAdd()}
          disabled={busy}
          className="btn-primary h-9 rounded-full px-4 text-xs font-semibold disabled:opacity-60"
        >
          {busy ? "Saving…" : "Block time"}
        </button>
      </div>

      {blocks.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {blocks.map((block) => (
            <li
              key={`${block.staffId}:${block.startAt}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 text-xs"
            >
              <span className="min-w-0 truncate text-zinc-300">
                {block.staffName} · {formatDayLabel(block.startAt.slice(0, 10))} ·{" "}
                {formatTime12(block.startAt.slice(11, 16))} –{" "}
                {formatTime12(block.endAt.slice(11, 16))}
              </span>
              <button
                type="button"
                onClick={() => void onRemove(block)}
                disabled={busy}
                className="shrink-0 text-zinc-400 hover:text-zinc-200 disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
