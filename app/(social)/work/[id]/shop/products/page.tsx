import type { Metadata } from "next";
import { PodProductsScreen } from "@/app/(social)/vendor/businesses/[id]/products/screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Products & delivery · Ruxstar", robots: { index: false } };

export default async function TeamShopProductsPage({ params }: Props) {
  return <PodProductsScreen id={(await params).id} team />;
}
