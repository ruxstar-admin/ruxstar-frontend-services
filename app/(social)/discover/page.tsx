import type { Metadata } from "next";
import { DiscoverScreen } from "./screen";

type Props = { searchParams: Promise<{ category?: string }> };

export const metadata: Metadata = { title: "Discover · Ruxstar", robots: { index: false } };

/** `?category=events`, `coaching`, `turf` or `stays` opens straight on that category, for links from tickets, classes, bookings, stays and their pages. */
export default async function DiscoverPage({ searchParams }: Props) {
  const { category } = await searchParams;
  return (
    <DiscoverScreen
      initialCategory={category === "events" || category === "coaching" || category === "turf" || category === "stays" ? category : null}
    />
  );
}
