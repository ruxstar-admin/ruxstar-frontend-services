import type { Metadata } from "next";
import { StoresScreen } from "./screen";

export const metadata: Metadata = { title: "Local shops · Ruxstar console", robots: { index: false } };

export default function StoresPage() {
  return <StoresScreen />;
}
