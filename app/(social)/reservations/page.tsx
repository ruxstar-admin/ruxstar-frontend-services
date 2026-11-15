import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MyStaysScreen } from "./screen";

type Props = { searchParams: Promise<{ order?: string }> };

export const metadata: Metadata = { title: "Your stays · Ruxstar", robots: { index: false } };

/** Cashfree sends the tenant back here with `?order=<id>`. */
export default async function ReservationsPage({ searchParams }: Props) {
  const { order } = await searchParams;
  if (order && /^[a-f\d]{24}$/i.test(order)) redirect(`/reservations/${order}?fresh=1`);
  return <MyStaysScreen />;
}
