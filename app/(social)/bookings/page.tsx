import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MyBookingsScreen } from "./screen";

type Props = { searchParams: Promise<{ order?: string }> };

export const metadata: Metadata = { title: "Your bookings · Ruxstar", robots: { index: false } };

/** Cashfree sends the player back here with `?order=<id>`. */
export default async function BookingsPage({ searchParams }: Props) {
  const { order } = await searchParams;
  if (order && /^[a-f\d]{24}$/i.test(order)) redirect(`/bookings/${order}?fresh=1`);
  return <MyBookingsScreen />;
}
