import type { Metadata } from "next";
import { OfferScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Custom offer · Ruxstar", robots: { index: false } };

/** A custom offer sent in a chat, opened from its card there. */
export default async function OfferPage({ params }: Props) {
  const { id } = await params;
  return <OfferScreen key={id} id={id} />;
}
