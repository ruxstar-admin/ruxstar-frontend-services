import type { Metadata } from "next";
import { NewVendorCouponScreen } from "@/app/(social)/vendor/coupons/new/screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "New coupon · Ruxstar", robots: { index: false } };

export default async function NewTeamCouponPage({ params }: Props) {
  return <NewVendorCouponScreen placeId={(await params).id} />;
}
