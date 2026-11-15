import type { Metadata } from "next";
import { VerifyScreen } from "./screen";

type Props = { searchParams: Promise<{ next?: string }> };

export const metadata: Metadata = { title: "Verification · Ruxstar", robots: { index: false } };

/** `?next=/path` brings you back there once you're verified, for pages that need KYC first (reserving a PG bed). */
export default async function VerifyPage({ searchParams }: Props) {
  const { next } = await searchParams;
  return <VerifyScreen next={next && next.startsWith("/") && !next.startsWith("//") && next.length <= 500 ? next : undefined} />;
}
