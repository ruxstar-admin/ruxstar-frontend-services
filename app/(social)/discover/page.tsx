import type { Metadata } from "next";
import type { BusinessModule } from "@/lib/api/shops";
import { DiscoverScreen } from "./screen";

type Props = { searchParams: Promise<{ category?: string }> };

export const metadata: Metadata = {
  title: "Discover local businesses · Ruxstar",
  description: "Browse events, courses, sports grounds, PGs and hostels, local shops and freelancers in Hyderabad. No account needed to look.",
  alternates: { canonical: "/discover" },
};

const CATEGORIES: readonly BusinessModule[] = ["pod", "events", "coaching", "turf", "stays", "shop", "gigs"];

/** `?category=pod`, `events`, `coaching`, `turf`, `stays`, `shop` or `gigs` opens straight on that category, for links from tickets, classes, bookings, stays, orders and their pages. */
export default async function DiscoverPage({ searchParams }: Props) {
  const { category } = await searchParams;
  return <DiscoverScreen initialCategory={CATEGORIES.find((c) => c === category) ?? null} />;
}
