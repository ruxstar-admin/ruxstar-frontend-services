import type { Metadata } from "next";
import { ReportsScreen } from "./screen";

export const metadata: Metadata = { title: "Reports · Ruxstar console", robots: { index: false } };

export default function ReportsPage() {
  return <ReportsScreen />;
}
