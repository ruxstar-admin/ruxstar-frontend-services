import type { Metadata } from "next";
import { GigCheckoutScreen } from "./screen";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ tier?: string }> };

export const metadata: Metadata = { title: "Order this gig · Ruxstar", robots: { index: false } };

/** `?tier=basic`, `standard` or `premium` is the package picked on the gig's page; the first one otherwise. */
export default async function GigCheckoutPage({ params, searchParams }: Props) {
  const [{ id }, { tier }] = await Promise.all([params, searchParams]);
  return <GigCheckoutScreen key={id} id={id} tier={tier ?? null} />;
}
