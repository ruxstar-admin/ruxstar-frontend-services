import type { Metadata } from "next";
import { GateListScreen } from "./screen";

export const metadata: Metadata = { title: "Scan tickets · Ruxstar", robots: { index: false } };

export default function GateListPage() {
  return <GateListScreen />;
}
