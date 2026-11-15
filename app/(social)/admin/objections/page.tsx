import type { Metadata } from "next";
import { ObjectionsScreen } from "./screen";

export const metadata: Metadata = { title: "Tenant objections · Ruxstar console", robots: { index: false } };

export default function ObjectionsPage() {
  return <ObjectionsScreen />;
}
