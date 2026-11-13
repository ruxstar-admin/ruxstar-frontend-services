import type { Metadata } from "next";
import { NewVendorCouponScreen } from "./screen";

export const metadata: Metadata = { title: "New coupon · Vendor portal", robots: { index: false } };

export default function NewVendorCouponPage() {
  return <NewVendorCouponScreen />;
}
