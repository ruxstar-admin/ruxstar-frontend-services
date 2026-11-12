import type { Metadata } from "next";
import { SalesScreen } from "./screen";

export const metadata: Metadata = { title: "Shop orders · Ruxstar", robots: { index: false } };

export default function SalesPage() {
  return <SalesScreen />;
}
