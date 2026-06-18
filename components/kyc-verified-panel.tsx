"use client";

import { useMemo } from "react";
import { RuxstarCard } from "@/components/ruxstar-card";
import {
  buildRuxstarCardFromKyc,
  type AuthUser,
  type RuxstarCardData,
  type VendorKycStatus,
} from "@/lib/api";
import { useRuxstarCard } from "@/lib/swr-hooks";

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
  const localCard = useMemo(() => buildRuxstarCardFromKyc(user, kyc), [user, kyc]);
  const { data: apiCard } = useRuxstarCard(kyc?.status === "verified");

  const card = useMemo(() => {
    if (localCard && apiCard) return mergeCard(localCard, apiCard);
    return localCard ?? apiCard ?? null;
  }, [localCard, apiCard]);

  return (
    <div className="mx-auto max-w-md">
      {card ? (
        <RuxstarCard card={card} />
      ) : (
        <div className="aspect-[1.586/1] w-full animate-pulse rounded-2xl bg-white/5" />
      )}
    </div>
  );
}
