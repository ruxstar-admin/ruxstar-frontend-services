import type { Metadata } from "next";
import { SupportSettingsScreen } from "./screen";

export const metadata: Metadata = { title: "Reply-by times · Ruxstar console", robots: { index: false } };

export default function SupportSettingsPage() {
  return <SupportSettingsScreen />;
}
