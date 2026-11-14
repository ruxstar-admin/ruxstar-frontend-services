import type { Metadata } from "next";
import { EventBookingsScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Bookings · Ruxstar", robots: { index: false } };

export default async function EventBookingsPage({ params }: Props) {
  return <EventBookingsScreen id={(await params).id} />;
}
