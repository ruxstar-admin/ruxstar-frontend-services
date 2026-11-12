import type { Metadata } from "next";
import { VendorPostsScreen } from "./screen";

export const metadata: Metadata = { title: "Business posts · Ruxstar", robots: { index: false } };

export default function VendorPostsPage() {
  return <VendorPostsScreen />;
}
