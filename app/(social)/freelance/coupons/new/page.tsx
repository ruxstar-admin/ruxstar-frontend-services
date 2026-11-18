import type { Metadata } from "next";
import { NewVendorCouponScreen } from "@/app/(social)/vendor/coupons/new/screen";

export const metadata: Metadata = { title: "New coupon · Freelancing · Ruxstar", robots: { index: false } };

export default function NewFreelanceCouponPage() {
  return <NewVendorCouponScreen freelance />;
}
