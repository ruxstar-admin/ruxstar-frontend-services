import type { Metadata } from "next";
import { BusinessDetailsScreen } from "@/app/(social)/vendor/businesses/[id]/details/screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Shop details · Ruxstar", robots: { index: false } };

export default async function TeamShopDetailsPage({ params }: Props) {
  return <BusinessDetailsScreen id={(await params).id} team />;
}
