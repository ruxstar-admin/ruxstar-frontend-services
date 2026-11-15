import type { Metadata } from "next";
import { VerifyScreen } from "./screen";

type Props = { searchParams: Promise<{ next?: string | string[] }> };

export const metadata: Metadata = { title: "Verification · Ruxstar", robots: { index: false } };

const BASE = "https://ruxstar.invalid";

/** Only same-site paths. Parsed rather than prefix-checked: browsers read "/\evil.com" and "/\t/evil.com" as "//evil.com". */
function samePath(next: string | string[] | undefined): string | undefined {
  if (typeof next !== "string" || !next.startsWith("/") || next.length > 500) return undefined;
  try {
    const url = new URL(next, BASE);
    return url.origin === BASE ? url.pathname + url.search + url.hash : undefined;
  } catch {
    return undefined;
  }
}

/** `?next=/path` brings you back there once you're verified, for pages that need KYC first (reserving a PG bed). */
export default async function VerifyPage({ searchParams }: Props) {
  const { next } = await searchParams;
  return <VerifyScreen next={samePath(next)} />;
}
