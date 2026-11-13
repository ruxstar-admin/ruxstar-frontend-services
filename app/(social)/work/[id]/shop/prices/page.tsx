import type { Metadata } from "next";
import { PodPricesScreen } from "@/app/(social)/vendor/businesses/[id]/prices/screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Prices · Ruxstar", robots: { index: false } };

export default async function TeamShopPricesPage({ params }: Props) {
  return <PodPricesScreen id={(await params).id} team />;
}
