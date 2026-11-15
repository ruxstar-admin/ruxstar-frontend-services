import type { Metadata } from "next";
import { PropertiesScreen } from "./screen";

export const metadata: Metadata = { title: "PGs & hostels · Ruxstar console", robots: { index: false } };

export default function PropertiesPage() {
  return <PropertiesScreen />;
}
