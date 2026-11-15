import type { Metadata } from "next";
import { DeskPropertiesScreen } from "./screen";

export const metadata: Metadata = { title: "Properties · Ruxstar", robots: { index: false } };

export default function DeskPropertiesPage() {
  return <DeskPropertiesScreen />;
}
