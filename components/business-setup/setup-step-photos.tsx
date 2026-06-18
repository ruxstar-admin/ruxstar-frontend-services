"use client";

import type { RefObject } from "react";

type DisplayPhoto = { id: string; url: string; pending: boolean };

type Props = {
  intro: string;
  photos: DisplayPhoto[];
  busy: boolean;
  fileRef: RefObject<HTMLInputElement | null>;
  onPick: (files: FileList | null) => void;
  onRemove: (photo: DisplayPhoto) => void;
};

export function SetupStepPhotos({ intro, photos, busy, fileRef, onPick, onRemove }: Props) {
  return (
    <div>
      {intro ? <p className="text-sm text-zinc-400">{intro}</p> : null}
      <div className="mt-4 grid grid-cols-3 gap-3">
        {photos.map((photo) => (
          <div
            key={photo.id}
            className="relative aspect-[4/3] overflow-hidden rounded-xl border border-white/10"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onRemove(photo)}
              disabled={busy}
              className="absolute right-1 top-1 rounded bg-black/60 px-2 py-0.5 text-xs text-zinc-200"
            >
              Remove
            </button>
          </div>
        ))}
        {photos.length < 3 && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex aspect-[4/3] flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/[0.02] text-xs text-zinc-500 hover:border-white/25"
          >
            + Add photo
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => onPick(e.target.files)}
      />
    </div>
  );
}
