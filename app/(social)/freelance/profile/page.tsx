import type { Metadata } from "next";
import { FreelanceProfileScreen } from "./screen";

export const metadata: Metadata = { title: "Profile and portfolio · Ruxstar", robots: { index: false } };

export default function FreelanceProfilePage() {
  return <FreelanceProfileScreen />;
}
