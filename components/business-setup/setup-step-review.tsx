"use client";

import type { BusinessResource, DayKey } from "@/lib/api";
import { DAY_SHORT, priceLabel, type BookingMode } from "@/lib/business-setup";

type Photo = { id: string; url: string };

type Props = {
  isFullDay: boolean;
  slotMinutes?: number;
  openDays: DayKey[];
  venueRules: string;
  maxGuests: string;
  photos: Photo[];
  resources: BusinessResource[];
  resourceLabel: string;
  showRules: boolean;
  showHallFields: boolean;
};

function formatInr(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

function resourceLine(r: BusinessResource, isFullDay: boolean, slotMinutes?: number) {
  const unit = isFullDay ? "/day" : `/${slotMinutes ?? 60}min`;
  const price = r.pricePerSlot != null ? formatInr(r.pricePerSlot) + unit : "—";
  const bits = [r.name, price];
  if (r.capacity) bits.push(`${r.capacity} guests`);
  return bits.join(" · ");
}

export function SetupStepReview({
  isFullDay,
  slotMinutes,
  openDays,
  venueRules,
  maxGuests,
  photos,
  resources,
  resourceLabel,
  showRules,
}: Props) {
  const rulesText = venueRules.trim();
  const guestsText = maxGuests.trim();
  const bookingMode: BookingMode = isFullDay ? "fullDay" : "slots";

  return (
    <div className="divide-y divide-white/5 rounded-xl border border-white/5 bg-[#121214] text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-500">Booking</p>
          <p className="mt-0.5 text-zinc-100">
            {isFullDay ? "Full day" : `Hourly · ${slotMinutes ?? 60} min slots`}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">{priceLabel(bookingMode)} set per {resourceLabel.toLowerCase()}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {openDays.map((day) => (
            <span
              key={day}
              className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-medium text-violet-200"
            >
              {DAY_SHORT[day]}
            </span>
          ))}
        </div>
      </div>

      {showRules && (guestsText || rulesText) && (
        <div className="px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-500">Rules</p>
          <div className="mt-1 space-y-1 text-zinc-300">
            {guestsText && (
              <p>
                <span className="text-zinc-500">Max guests</span> · {guestsText}
              </p>
            )}
            {rulesText && (
              <p className="line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed text-zinc-400">
                {rulesText}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="px-4 py-3">
        <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-500">
          {resourceLabel} ({resources.length})
        </p>
        {resources.length > 0 ? (
          <ul className="mt-2 space-y-1 text-zinc-300">
            {resources.map((r) => (
              <li key={r.id} className="text-xs sm:text-sm">
                {resourceLine(r, isFullDay, slotMinutes)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-zinc-600">None</p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-500">Photos</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {photos.length > 0 ? `${photos.length} gallery` : "Cover only"}
          </p>
        </div>
        {photos.length > 0 && (
          <div className="flex shrink-0 gap-1">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="h-9 w-12 overflow-hidden rounded border border-white/10"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt="" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
