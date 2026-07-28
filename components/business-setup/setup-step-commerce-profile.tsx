"use client";

import type { CommerceProfile } from "@/lib/api";

const input = "field-input";

type Props = {
  value: CommerceProfile;
  onChange: (patch: Partial<CommerceProfile>) => void;
};

export function SetupStepCommerceProfile({ value, onChange }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium text-zinc-200">Pickup & shop notes</p>
        <p className="mt-1 text-sm text-zinc-500">
          Customers pick up in store after paying. Tell them hours, landmark, or packing notes.
        </p>
        <textarea
          className={`${input} mt-3 min-h-[5rem] resize-none`}
          placeholder="e.g. Pickup Mon–Sat 10am–7pm from the counter. Bring your order ID."
          maxLength={1000}
          value={value.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
        />
      </div>

      <label className="block">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Minimum order value (optional)
        </span>
        <div className="relative mt-1.5">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
            ₹
          </span>
          <input
            className={`${input} pl-7`}
            inputMode="numeric"
            placeholder="0"
            value={value.minOrderValue || ""}
            onChange={(e) => {
              const n = Math.round(Number(e.target.value.replace(/\D/g, "") || 0));
              onChange({ minOrderValue: Number.isFinite(n) ? n : 0 });
            }}
          />
        </div>
        <p className="mt-1 text-xs text-zinc-600">Leave 0 for no minimum.</p>
      </label>
    </div>
  );
}
