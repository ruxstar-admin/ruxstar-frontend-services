import type { Metadata } from "next";
import { SavedScreen } from "./screen";

export const metadata: Metadata = { title: "Saved · Ruxstar", robots: { index: false } };

export default function SavedPage() {
  return <SavedScreen />;
}
