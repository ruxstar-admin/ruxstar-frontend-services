import type { Metadata } from "next";
import { VendorCouponsScreen } from "@/app/(social)/vendor/coupons/screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Coupons · Ruxstar", robots: { index: false } };

export default async function TeamCouponsPage({ params }: Props) {
  return <VendorCouponsScreen placeId={(await params).id} />;
}
