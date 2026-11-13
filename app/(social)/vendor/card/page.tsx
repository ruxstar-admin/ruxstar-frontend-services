import type { Metadata } from "next";
import { VendorCardScreen } from "./screen";

export const metadata: Metadata = { title: "Ruxstar Card · Vendor portal", robots: { index: false } };

export default function VendorCardPage() {
  return <VendorCardScreen />;
}
