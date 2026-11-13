"use client";

import { useEffect, useState } from "react";
import { useOnSignedOut } from "@/components/social/session";
import type { PublicProfile } from "@/lib/api/account";
import { findPeople } from "@/lib/api/social";

const DEBOUNCE_MS = 250;

interface Outcome {
  term: string;
  people: PublicProfile[];
  failed: boolean;
}

/** People by name or @username, or the newest members before typing. Null while a search is out; stale answers are ignored. */
export function usePeopleSearch(query: string, enabled = true) {
  const onSignedOut = useOnSignedOut();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const term = query.trim().replace(/^@/, "");

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const timer = setTimeout(
      () =>
        findPeople(term || undefined)
          .then((people) => live && setOutcome({ term, people, failed: false }))
          .catch((err) => live && !onSignedOut(err) && setOutcome({ term, people: [], failed: true })),
      term ? DEBOUNCE_MS : 0,
    );
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [term, enabled, onSignedOut]);

  return outcome?.term === term ? outcome : null;
}
