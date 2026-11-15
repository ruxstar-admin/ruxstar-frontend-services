import type { Metadata } from "next";
import { DiscoverScreen } from "./screen";

type Props = { searchParams: Promise<{ category?: string }> };

export const metadata: Metadata = { title: "Discover · Ruxstar", robots: { index: false } };

/** `?category=events`, `coaching` or `turf` opens straight on that category, for links from tickets, classes, bookings and their pages. */
export default async function DiscoverPage({ searchParams }: Props) {
  const { category } = await searchParams;
  return <DiscoverScreen initialCategory={category === "events" || category === "coaching" || category === "turf" ? category : null} />;
}
