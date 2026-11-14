import type { Metadata } from "next";
import { DiscoverScreen } from "./screen";

type Props = { searchParams: Promise<{ category?: string }> };

export const metadata: Metadata = { title: "Discover · Ruxstar", robots: { index: false } };

/** `?category=events` opens straight on Events, for links from tickets and events pages. */
export default async function DiscoverPage({ searchParams }: Props) {
  const { category } = await searchParams;
  return <DiscoverScreen initialCategory={category === "events" ? "events" : null} />;
}
