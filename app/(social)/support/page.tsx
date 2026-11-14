import type { Metadata } from "next";
import { SupportList } from "@/components/support/SupportList";

export const metadata: Metadata = { title: "Help & support · Ruxstar", robots: { index: false } };

export default function SupportPage() {
  return <SupportList />;
}
