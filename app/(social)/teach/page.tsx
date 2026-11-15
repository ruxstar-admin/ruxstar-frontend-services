import type { Metadata } from "next";
import { TeachScreen } from "./screen";

export const metadata: Metadata = { title: "Classes · Ruxstar", robots: { index: false } };

export default function TeachPage() {
  return <TeachScreen />;
}
