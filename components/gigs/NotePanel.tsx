"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { TextArea } from "@/components/vendor/parts";
import order from "@/components/shop/order.module.css";

/**
 * A step that asks to confirm, with a note when `prompt` is given: approving, asking for changes, reporting a problem,
 * declining or cancelling. `min` 0 makes the note optional.
 */
export function NotePanel({
  title,
  message,
  prompt,
  placeholder,
  min = 0,
  max = 1000,
  confirm,
  danger,
  busy,
  failure,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  prompt?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  confirm: string;
  danger?: boolean;
  busy: boolean;
  failure: string | null;
  onConfirm: (note: string) => void;
  onCancel: () => void;
}) {
  const [note, setNote] = useState("");
  const length = note.trim().length;
  const short = !!prompt && length < min;
  return (
    <div className={order.news} role="group" aria-label={title}>
      <strong>{title}</strong>
      <p className={order.small}>{message}</p>
      {prompt && (
        <TextArea
          label={prompt}
          value={note}
          onChange={setNote}
          max={max}
          placeholder={placeholder}
          error={length > 0 && short ? `Use at least ${min} characters.` : undefined}
        />
      )}
      {failure && (
        <p className={order.error} role="alert">
          {failure}
        </p>
      )}
      <div className={order.actions}>
        <Button variant={danger ? "danger" : "primary"} loading={busy} disabled={short} onClick={() => onConfirm(note.trim())}>
          {confirm}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={onCancel}>
          Not now
        </Button>
      </div>
    </div>
  );
}
