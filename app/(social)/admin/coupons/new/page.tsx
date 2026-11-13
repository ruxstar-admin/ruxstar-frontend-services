import type { Metadata } from "next";
import { NewCouponScreen } from "./screen";

export const metadata: Metadata = { title: "New coupon · Ruxstar console", robots: { index: false } };

export default function NewCouponPage() {
  return <NewCouponScreen />;
}
