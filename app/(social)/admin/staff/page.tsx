import type { Metadata } from "next";
import { StaffScreen } from "./screen";

export const metadata: Metadata = { title: "Staff · Ruxstar console", robots: { index: false } };

export default function StaffPage() {
  return <StaffScreen />;
}
