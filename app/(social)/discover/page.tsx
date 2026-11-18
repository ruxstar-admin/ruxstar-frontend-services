import type { Metadata } from "next";
import { DiscoverScreen } from "./screen";

type Props = { searchParams: Promise<{ category?: string }> };

export const metadata: Metadata = {
  title: "Discover local businesses · Ruxstar",
  description: "Browse events, courses, sports grounds, PGs and hostels, and local shops in Vijayawada, Gudivada and Hyderabad. No account needed to look.",
  alternates: { canonical: "/discover" },
};

/** `?category=pod`, `events`, `coaching`, `turf`, `stays` or `shop` opens straight on that category, for links from tickets, classes, bookings, stays, orders and their pages. */
export default async function DiscoverPage({ searchParams }: Props) {
  const { category } = await searchParams;
  return (
    <DiscoverScreen
      initialCategory={
        category === "pod" || category === "events" || category === "coaching" || category === "turf" || category === "stays" || category === "shop"
          ? category
          : null
      }
    />
  );
}
