"use client";

import { useEffect, useState } from "react";
import { RuxstarCard } from "@/components/ruxstar-card";
import {
  buildRuxstarCardFromKyc,
  getRuxstarCard,
  getVendorKycStatus,
  type AuthUser,
  type RuxstarCardData,
  type VendorKycStatus,
} from "@/lib/api";

type Props = {
  user: AuthUser | null;
  kyc: VendorKycStatus | null;
};

function mergeCard(local: RuxstarCardData, api: RuxstarCardData): RuxstarCardData {
  return {
    ruxstarId: api.ruxstarId || local.ruxstarId,
    name: api.name || local.name,
    mobile: api.mobile || local.mobile,
    aadhaar: api.aadhaar || local.aadhaar,
    pan: api.pan || local.pan,
    memberSince: api.memberSince || local.memberSince,
  };
}

export function KycVerifiedPanel({ user, kyc }: Props) {
  const [card, setCard] = useState<RuxstarCardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      const freshKyc = await getVendorKycStatus().catch(() => kyc);
      const local = buildRuxstarCardFromKyc(user, freshKyc);
      if (!active) return;

      if (local) setCard(local);

      try {
        const api = await getRuxstarCard();
        if (!active) return;
        if (local) setCard(mergeCard(local, api));
        else setCard(api);
      } catch {
        if (active && local) setCard(local);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [user, kyc]);

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
