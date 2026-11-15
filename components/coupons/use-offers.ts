"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formError } from "@/lib/api/account";

/** What an offers route answers: the offers for this order, best first, and the code it was asked to check. */
export interface OffersAnswer {
  offers: { code: string; fundedBy: "ruxstar" | "vendor"; label: string; terms: string | null; discount: number; problem: string | null }[];
  checked: { code: string; discount: number; problem: string | null } | null;
}

/**
 * A booking's coupon, for checkouts that ask an offers route (event tickets, coaching fees). `key` is what the price
 * depends on: whenever it changes the offers load again and a code already applied is checked again, so the discount
 * always matches the order. Null loads nothing (free, or not at the pay step yet).
 */
export function useOffers(load: (code?: string) => Promise<OffersAnswer>, key: string | null) {
  const [offers, setOffers] = useState<OffersAnswer["offers"] | null>(null);
  const [applied, setApplied] = useState<{ code: string; label: string; discount: number } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const loadRef = useRef(load);
  const appliedCode = useRef<string | null>(null);

  useEffect(() => {
    loadRef.current = load;
    appliedCode.current = applied?.code ?? null;
  });

  const settle = useCallback((answer: OffersAnswer) => {
    setOffers(answer.offers);
    const checked = answer.checked;
    if (!checked) return;
    if (!checked.problem && checked.discount > 0) {
      setApplied({ code: checked.code, label: answer.offers.find((o) => o.code === checked.code)?.label ?? "", discount: checked.discount });
      setProblem(null);
    } else {
      setApplied(null);
      setProblem(checked.problem ?? "This code doesn’t take anything off this order.");
    }
  }, []);

  useEffect(() => {
    if (key === null) return;
    let live = true;
    loadRef.current(appliedCode.current ?? undefined).then(
      (answer) => live && settle(answer),
      () => live && setOffers([]),
    );
    return () => {
      live = false;
    };
  }, [key, settle]);

  const apply = async (code: string) => {
    setBusy(true);
    setProblem(null);
    try {
      settle(await loadRef.current(code));
    } catch (err) {
      setProblem(formError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    setApplied(null);
    setProblem(null);
  };

  return { offers, applied, discount: applied?.discount ?? 0, problem, busy, apply, remove };
}
