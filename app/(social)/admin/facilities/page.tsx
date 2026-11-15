import type { Metadata } from "next";
import { FacilitiesScreen } from "./screen";

export const metadata: Metadata = { title: "Facilities · Ruxstar console", robots: { index: false } };

export default function FacilitiesPage() {
  return <FacilitiesScreen />;
}
