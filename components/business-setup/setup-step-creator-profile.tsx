"use client";

import type { CreatorProfile } from "@/lib/api";

const input = "field-input";

type Props = {
  value: CreatorProfile;
  onChange: (patch: Partial<CreatorProfile>) => void;
};

export function SetupStepCreatorProfile({ value, onChange }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium text-zinc-200">About you</p>
        <p className="mt-1 text-sm text-zinc-500">
          Customers book collabs and shoutouts — help them understand your brand.
        </p>
        <textarea
          className={`${input} mt-3 min-h-[5rem] resize-none`}
          placeholder="Who you are, what you create, and what makes your collabs special."
          maxLength={2000}
          value={value.bio}
          onChange={(e) => onChange({ bio: e.target.value })}
        />
      </div>

      <label className="block">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Niche</span>
        <input
          className={`${input} mt-1.5`}
          placeholder="e.g. Fitness, comedy, education"
          maxLength={120}
          value={value.niche}
          onChange={(e) => onChange({ niche: e.target.value })}
        />
      </label>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Social links</p>
        <input
          className={input}
          placeholder="Instagram @handle or URL"
          value={value.socialLinks.instagram}
          onChange={(e) =>
            onChange({ socialLinks: { ...value.socialLinks, instagram: e.target.value } })
          }
        />
        <input
          className={input}
          placeholder="YouTube channel URL"
          value={value.socialLinks.youtube}
          onChange={(e) =>
            onChange({ socialLinks: { ...value.socialLinks, youtube: e.target.value } })
          }
        />
        <input
          className={input}
          placeholder="Other link (optional)"
          value={value.socialLinks.other}
          onChange={(e) =>
            onChange({ socialLinks: { ...value.socialLinks, other: e.target.value } })
          }
        />
      </div>

      <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
        <input
          type="checkbox"
          checked={value.acceptingBookings !== false}
          onChange={(e) => onChange({ acceptingBookings: e.target.checked })}
          className="h-4 w-4 rounded border-white/20"
        />
        <span className="text-sm text-zinc-300">Accepting new collab bookings</span>
      </label>
    </div>
  );
}
