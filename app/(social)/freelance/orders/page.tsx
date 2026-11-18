import type { Metadata } from "next";
import { DeskGigOrdersScreen } from "./screen";

export const metadata: Metadata = { title: "Freelance orders · Ruxstar", robots: { index: false } };

export default function DeskGigOrdersPage() {
  return <DeskGigOrdersScreen />;
}
