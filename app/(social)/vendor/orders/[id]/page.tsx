import type { Metadata } from "next";
import { ShopOrderScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Order · Ruxstar", robots: { index: false } };

export default async function ShopOrderPage({ params }: Props) {
  return <ShopOrderScreen id={(await params).id} />;
}
