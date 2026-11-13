import type { Metadata } from "next";
import { VendorCouponsScreen } from "./screen";

export const metadata: Metadata = { title: "Coupons · Vendor portal", robots: { index: false } };

export default function VendorCouponsPage() {
  return <VendorCouponsScreen />;
}
