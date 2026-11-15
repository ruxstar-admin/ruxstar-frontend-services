import type { Metadata } from "next";
import { SportsScreen } from "./screen";

export const metadata: Metadata = { title: "Sports · Ruxstar console", robots: { index: false } };

export default function SportsPage() {
  return <SportsScreen />;
}
