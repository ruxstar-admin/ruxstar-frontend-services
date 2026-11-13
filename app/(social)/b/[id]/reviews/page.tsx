import type { Metadata } from "next";
import { ShopReviewsScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Reviews · Ruxstar", robots: { index: false } };

export default async function ShopReviewsPage({ params }: Props) {
  return <ShopReviewsScreen id={(await params).id} />;
}
