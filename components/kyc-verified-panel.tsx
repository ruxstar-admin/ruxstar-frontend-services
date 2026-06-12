"use client";

import { useEffect, useState } from "react";
import { RuxstarCard } from "@/components/ruxstar-card";
import { getRuxstarCard, type RuxstarCardData } from "@/lib/api";

type Props = {
  fallbackName?: string;
  fallbackId?: string;
};

function fallbackRuxstarId(userId?: string) {
  if (!userId) return "RUX-0000-0000";
  const clean = userId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const tail = clean.slice(-8).padStart(8, "0");
  return `RUX-${tail.slice(0, 4)}-${tail.slice(4, 8)}`;
}

export function KycVerifiedPanel({ fallbackName, fallbackId }: Props) {
  const [card, setCard] = useState<RuxstarCardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getRuxstarCard()
      .then((data) => {
        if (active) setCard(data);
      })
      .catch(() => {
        if (active) {
          setCard({
            ruxstarId: fallbackRuxstarId(fallbackId),
            name: fallbackName ?? null,
            aadhaar: null,
            pan: null,
            memberSince: null,
          });
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fallbackId, fallbackName]);

  return (
    <div className="mx-auto max-w-md">
      {loading || !card ? (
        <div className="aspect-[1.586/1] w-full animate-pulse rounded-2xl bg-white/5" />
      ) : (
        <RuxstarCard card={card} />
      )}
    </div>
  );
}
