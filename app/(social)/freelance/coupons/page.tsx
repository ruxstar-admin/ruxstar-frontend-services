import type { Metadata } from "next";
import { VendorCouponsScreen } from "@/app/(social)/vendor/coupons/screen";

export const metadata: Metadata = { title: "Coupons · Freelancing · Ruxstar", robots: { index: false } };

/** A freelancer's coupons for their gigs and offers, for freelancers who aren't vendors. */
export default function FreelanceCouponsPage() {
  return <VendorCouponsScreen freelance />;
}
