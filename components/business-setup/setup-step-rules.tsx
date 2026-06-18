"use client";

import type { RulesVariant } from "@/lib/business-setup-flows";
import { RULES_PLACEHOLDERS } from "@/lib/business-setup-flows";

const input = "field-input";

type Props = {
  intro: string;
  variant?: RulesVariant;
  maxGuests: string;
  venueRules: string;
  onMaxGuestsChange: (v: string) => void;
  onVenueRulesChange: (v: string) => void;
};

export function SetupStepRules({
  intro,
  variant = "venue",
  maxGuests,
  venueRules,
  onMaxGuestsChange,
  onVenueRulesChange,
}: Props) {
  return (
    <div className="space-y-4">
      {intro ? <p className="text-sm text-zinc-400">{intro}</p> : null}
      <label className="block">
        <span className="text-xs text-zinc-500">Maximum guests allowed</span>
        <input
          className={`${input} mt-1 py-2 text-sm`}
          inputMode="numeric"
          placeholder="e.g. 200"
          value={maxGuests}
          onChange={(e) => onMaxGuestsChange(e.target.value.replace(/\D/g, ""))}
        />
      </label>
      <label className="block">
        <span className="text-xs text-zinc-500">Rules for customers</span>
        <textarea
          className={`${input} mt-1 min-h-[7rem] resize-y py-2 text-sm`}
          placeholder={RULES_PLACEHOLDERS[variant]}
          value={venueRules}
          onChange={(e) => onVenueRulesChange(e.target.value)}
          maxLength={2000}
        />
      </label>
    </div>
  );
}
