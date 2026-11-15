import type { Metadata } from "next";
import { DeskStoresScreen } from "./screen";

export const metadata: Metadata = { title: "Shop desk · Ruxstar", robots: { index: false } };

export default function DeskStoresPage() {
  return <DeskStoresScreen />;
}
