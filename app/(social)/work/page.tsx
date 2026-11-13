import type { Metadata } from "next";
import { WorkScreen } from "./screen";

export const metadata: Metadata = { title: "Work · Ruxstar", robots: { index: false } };

export default function WorkPage() {
  return <WorkScreen />;
}
