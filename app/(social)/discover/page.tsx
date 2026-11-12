import type { Metadata } from "next";
import { DiscoverScreen } from "./screen";

export const metadata: Metadata = { title: "Discover · Ruxstar", robots: { index: false } };

export default function DiscoverPage() {
  return <DiscoverScreen />;
}
