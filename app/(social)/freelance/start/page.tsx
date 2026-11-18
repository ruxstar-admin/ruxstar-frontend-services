import type { Metadata } from "next";
import { StartFreelancingScreen } from "./screen";

export const metadata: Metadata = { title: "Start freelancing · Ruxstar", robots: { index: false } };

export default function StartFreelancingPage() {
  return <StartFreelancingScreen />;
}
