import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OrdersScreen } from "./screen";

type Props = { searchParams: Promise<{ order?: string }> };

export const metadata: Metadata = { title: "Your orders · Ruxstar", robots: { index: false } };

/** The checkout page sends the customer back here with `?order=<id>`. */
export default async function OrdersPage({ searchParams }: Props) {
  const { order } = await searchParams;
  if (order && /^[a-f\d]{24}$/i.test(order)) redirect(`/orders/${order}`);
  return <OrdersScreen />;
}
