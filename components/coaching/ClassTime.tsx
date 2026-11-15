"use client";

import { useId, useState } from "react";
import { Button, Input } from "@/components/ui";
import { TextArea } from "@/components/vendor/parts";
import { clockText, lengthText, startOf } from "@/lib/coaching";
import { fromIst, istParts, istToday } from "@/lib/events";
import vendor from "@/components/vendor/vendor.module.css";

const STARTS = Array.from({ length: (23 - 5) * 4 + 1 }, (_, i) => startOf(5 * 60 + i * 15));
const LENGTHS = Array.from({ length: 16 }, (_, i) => (i + 1) * 15);

export interface ClassTimeValue {
  startsAt: string;
  minutes: number;
  reason?: string;
}

function Pick({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div className={vendor.field}>
      <label htmlFor={id} className={vendor.label}>
        {label}
      </label>
      <select id={id} className={vendor.select} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** A day, a start in 15-minute steps and a length, in India time; with `withReason`, an optional note for students. */
export function ClassTime({
  title,
  start,
  minutes,
  withReason,
  confirmLabel,
  busy,
  failure,
  onConfirm,
  onCancel,
}: {
  title: string;
  start: string;
  minutes: number;
  withReason?: boolean;
  confirmLabel: string;
  busy: boolean;
  failure: string | null;
  onConfirm: (value: ClassTimeValue) => void;
  onCancel: () => void;
}) {
  const initial = istParts(start);
  const [day, setDay] = useState(initial.day);
  const [time, setTime] = useState(STARTS.includes(initial.time) ? initial.time : "17:00");
  const [length, setLength] = useState(LENGTHS.includes(minutes) ? minutes : 60);
  const [reason, setReason] = useState("");
  const [openedAt] = useState(Date.now);
  const startsAt = day ? fromIst(day, time) : "";
  const past = !!startsAt && Date.parse(startsAt) <= openedAt;
  const reasonShort = withReason && reason.trim().length > 0 && reason.trim().length < 3;

  return (
    <section className={vendor.card}>
      <h2 className={vendor.section}>{title}</h2>
      <Input label="Day" type="date" min={istToday(openedAt)} value={day} onChange={(e) => setDay(e.target.value)} error={past ? "Pick a time from now on" : undefined} />
      <div className={vendor.pair} data-even>
        <Pick label="Starts" value={time} options={STARTS.map((t) => ({ value: t, label: clockText(t) }))} onChange={setTime} />
        <Pick label="Lasts" value={String(length)} options={LENGTHS.map((m) => ({ value: String(m), label: lengthText(m) }))} onChange={(v) => setLength(Number(v))} />
      </div>
      {withReason && <TextArea label="Tell them why (optional)" value={reason} onChange={setReason} max={300} placeholder="e.g. Hall booked for exams that day" />}
      <p className={vendor.faint}>Every student and parent is told. Times are India time.</p>
      {failure && (
        <p className={vendor.error} role="alert">
          {failure}
        </p>
      )}
      <div className={vendor.actions}>
        <Button
          loading={busy}
          disabled={!day || past || reasonShort}
          onClick={() => onConfirm({ startsAt, minutes: length, ...(withReason && reason.trim() ? { reason: reason.trim() } : {}) })}
        >
          {confirmLabel}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </section>
  );
}
