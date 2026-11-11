import type { Metadata } from "next";
import { Dashboard } from "./dashboard";

export const metadata: Metadata = { title: "Dashboard · Ruxstar console", robots: { index: false } };

export default function AdminHomePage() {
  return <Dashboard />;
}
