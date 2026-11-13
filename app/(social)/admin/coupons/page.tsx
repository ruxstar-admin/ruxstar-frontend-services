import type { Metadata } from "next";
import { CouponsScreen } from "./screen";

export const metadata: Metadata = { title: "Coupons · Ruxstar console", robots: { index: false } };

export default function CouponsPage() {
  return <CouponsScreen />;
}
