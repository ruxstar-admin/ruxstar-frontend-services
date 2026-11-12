import type { Metadata } from "next";
import { BlockedScreen } from "./screen";

export const metadata: Metadata = { title: "Blocked accounts · Ruxstar", robots: { index: false } };

export default function BlockedPage() {
  return <BlockedScreen />;
}
