import type { Metadata } from "next";
import { ModulesScreen } from "./screen";

export const metadata: Metadata = { title: "Modules · Ruxstar console", robots: { index: false } };

export default function ModulesPage() {
  return <ModulesScreen />;
}
