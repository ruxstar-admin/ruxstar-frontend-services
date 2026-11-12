import type { Metadata } from "next";
import { BusinessesScreen } from "./screen";

export const metadata: Metadata = { title: "Businesses · Ruxstar", robots: { index: false } };

export default function BusinessesPage() {
  return <BusinessesScreen />;
}
