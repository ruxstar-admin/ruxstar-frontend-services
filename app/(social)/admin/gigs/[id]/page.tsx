import type { Metadata } from "next";
import { GigListingCaseScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Gig · Ruxstar console", robots: { index: false } };

export default async function GigListingCasePage({ params }: Props) {
  const { id } = await params;
  return <GigListingCaseScreen key={id} id={id} />;
}
