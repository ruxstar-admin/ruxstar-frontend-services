import type { Metadata } from "next";
import { FreelancersScreen } from "./screen";

export const metadata: Metadata = { title: "Freelancers · Ruxstar console", robots: { index: false } };

export default function FreelancersPage() {
  return <FreelancersScreen />;
}
