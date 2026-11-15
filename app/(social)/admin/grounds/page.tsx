import type { Metadata } from "next";
import { GroundsScreen } from "./screen";

export const metadata: Metadata = { title: "Grounds · Ruxstar console", robots: { index: false } };

export default function GroundsPage() {
  return <GroundsScreen />;
}
