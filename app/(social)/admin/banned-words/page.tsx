import type { Metadata } from "next";
import { BannedScreen } from "./screen";

export const metadata: Metadata = { title: "Banned categories · Ruxstar console", robots: { index: false } };

export default function BannedPage() {
  return <BannedScreen />;
}
