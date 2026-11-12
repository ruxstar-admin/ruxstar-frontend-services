import type { Metadata } from "next";
import { OrderScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Print order · Ruxstar", robots: { index: false } };

export default async function OrderPage({ params }: Props) {
  return <OrderScreen id={(await params).id} />;
}
