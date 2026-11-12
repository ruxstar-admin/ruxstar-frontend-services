import type { Metadata } from "next";
import { PlaceOrderScreen } from "./screen";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ product?: string }> };

export const metadata: Metadata = { title: "Place order · Ruxstar", robots: { index: false } };

export default async function PlaceOrderPage({ params, searchParams }: Props) {
  return <PlaceOrderScreen id={(await params).id} product={(await searchParams).product} />;
}
