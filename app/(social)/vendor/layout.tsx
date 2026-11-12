import type { Metadata } from "next";
import type { ReactNode } from "react";
import { VendorFrame } from "@/components/vendor/VendorFrame";

export const metadata: Metadata = { title: "Vendor portal · Ruxstar", robots: { index: false } };

export default function VendorLayout({ children }: { children: ReactNode }) {
  return <VendorFrame>{children}</VendorFrame>;
}
