import type { Metadata } from "next";
import { DeskGroundsScreen } from "./screen";

export const metadata: Metadata = { title: "Grounds · Ruxstar", robots: { index: false } };

export default function DeskGroundsPage() {
  return <DeskGroundsScreen />;
}
