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
  const [loaded, setLoaded] = useState<string | null>(null);
  const loadRef = useRef(load);
  const appliedCode = useRef<string | null>(null);
  /** Only the latest request may settle: an older answer, or one sent before Remove, would bring back a stale discount. */
  const latest = useRef(0);

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
    const ask = ++latest.current;
    loadRef.current(appliedCode.current ?? undefined).then(
      (answer) => {
        if (!live) return;
        setLoaded(key);
        if (ask !== latest.current) return;
        settle(answer);
        setBusy(false);
      },
      () => {
        if (!live) return;
        setLoaded(key);
        if (ask !== latest.current) return;
        setOffers([]);
        setBusy(false);
      },
    );
    return () => {
      live = false;
    };
  }, [key, settle]);

  const apply = async (code: string) => {
    const ask = ++latest.current;
    setBusy(true);
    setProblem(null);
    try {
      const answer = await loadRef.current(code);
      if (ask === latest.current) settle(answer);
    } catch (err) {
      if (ask === latest.current) setProblem(formError(err).message);
    } finally {
      if (ask === latest.current) setBusy(false);
    }
  };

  const remove = () => {
    latest.current++;
    setApplied(null);
    setProblem(null);
    setBusy(false);
  };

  /** The price for this order isn't back yet (first load, a re-price, or a code being checked): Pay waits. */
  const pricing = busy || (key !== null && loaded !== key);

  return { offers, applied, discount: applied?.discount ?? 0, problem, busy, pricing, apply, remove };
}
