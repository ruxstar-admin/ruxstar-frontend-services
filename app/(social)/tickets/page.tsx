import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MyTicketsScreen } from "./screen";

type Props = { searchParams: Promise<{ order?: string }> };

export const metadata: Metadata = { title: "Your tickets · Ruxstar", robots: { index: false } };

/** Cashfree sends the buyer back here with `?order=<id>`. */
export default async function TicketsPage({ searchParams }: Props) {
  const { order } = await searchParams;
  if (order && /^[a-f\d]{24}$/i.test(order)) redirect(`/tickets/${order}?fresh=1`);
  return <MyTicketsScreen />;
}
