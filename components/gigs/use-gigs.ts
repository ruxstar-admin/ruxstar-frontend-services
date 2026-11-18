"use client";

import { useLoad } from "@/components/vendor/use-load";
import { gigsRules, myFreelancerOrNull, type GigsRules, type MyFreelancer } from "@/lib/api/gigs";

/** The rules change only when the Ruxstar team edits them; a few minutes old is fine. */
const RULES_FRESH_MS = 5 * 60_000;
let rules: { at: number; value: GigsRules } | null = null;

export async function loadGigsRules(): Promise<GigsRules> {
  if (rules && Date.now() - rules.at < RULES_FRESH_MS) return rules.value;
  const value = await gigsRules();
  rules = { at: Date.now(), value };
  return value;
}

export const useGigsRules = () => useLoad(loadGigsRules);

/** People who haven't started freelancing aren't asked again this visit, so chats don't each look it up. */
let notStarted = false;

/** Your freelancer profile, or null until you start. */
export async function loadMyFreelancer(): Promise<MyFreelancer | null> {
  if (notStarted) return null;
  const profile = await myFreelancerOrNull();
  notStarted = profile === null;
  return profile;
}

/** Call after starting, so the next look-up asks the API again. */
export const freelancerStarted = () => {
  notStarted = false;
};

/** Your freelancer profile and the rules together, for the freelancer's screens. */
export const useFreelancing = (key = "") => useLoad(() => Promise.all([loadMyFreelancer(), loadGigsRules()]).then(([me, rules]) => ({ me, rules })), key);
