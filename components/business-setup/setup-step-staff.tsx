"use client";

import { useState } from "react";
import type { BusinessStaff } from "@/lib/api";

const input = "field-input";

type Props = {
  staff: BusinessStaff[];
  staffNoun: string;
  onAdd: (name: string, role: string) => void;
  onRemove: (id: string) => void;
};

export function SetupStepStaff({ staff, staffNoun, onAdd, onRemove }: Props) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");

  function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed, role.trim());
    setName("");
    setRole("");
  }

  const noun = staffNoun || "staff member";

  return (
    <div>
      <p className="text-sm font-medium text-zinc-200">Your team</p>
      <p className="mt-1 text-sm text-zinc-500">
        Each booking takes one {noun}&apos;s time. Customers can pick a specific {noun} or
        &ldquo;anyone&rdquo;.
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          className={`${input} flex-1`}
          placeholder={`${noun.charAt(0).toUpperCase()}${noun.slice(1)} name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
        />
        <input
          className={`${input} flex-1`}
          placeholder="Role (optional)"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
        />
        <button
          type="button"
          onClick={add}
          className="btn-primary rounded-xl px-5 py-2.5 text-sm font-semibold"
        >
          Add
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {staff.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-zinc-600">
            No {noun}s yet. Add at least one to continue.
          </p>
        ) : (
          staff.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-100">{s.name}</p>
                {s.role && <p className="truncate text-xs text-zinc-500">{s.role}</p>}
              </div>
              <button
                type="button"
                onClick={() => onRemove(s.id)}
                className="shrink-0 rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-white/5 hover:text-red-300"
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
