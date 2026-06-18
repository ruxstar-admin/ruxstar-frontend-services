"use client";

import { useMemo, useState } from "react";
import {
  businessThumbnailCandidates,
  type Business,
} from "@/lib/api";

type Props = {
  business: Pick<Business, "id" | "thumbnailUrl" | "thumbnailPhotoId" | "setup" | "categoryLabel">;
  className?: string;
  fallbackClassName?: string;
  onMissingClick?: () => void;
  uploading?: boolean;
};

export function BusinessThumbnail({
  business,
  className = "h-full w-full object-cover",
  fallbackClassName,
  onMissingClick,
  uploading = false,
}: Props) {
  const candidates = useMemo(() => businessThumbnailCandidates(business), [business]);
  const [index, setIndex] = useState(0);
  const src = candidates[index];
  const initial = business.categoryLabel?.trim().slice(0, 1).toUpperCase() || "?";

  if (!src) {
    const fallback = (
      <div
        className={
          fallbackClassName ??
          "flex h-full items-center justify-center bg-gradient-to-br from-zinc-900 to-[#121214] text-3xl text-zinc-600"
        }
      >
        {uploading ? "…" : initial}
      </div>
    );
    if (onMissingClick) {
      return (
        <button
          type="button"
          onClick={onMissingClick}
          className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-zinc-900 to-[#121214] text-zinc-500 hover:text-zinc-300"
        >
          <span className="text-2xl">+</span>
          <span className="text-xs">Add cover photo</span>
        </button>
      );
    }
    return fallback;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className={className}
      onError={() => {
        if (index < candidates.length - 1) setIndex(index + 1);
      }}
    />
  );
}
