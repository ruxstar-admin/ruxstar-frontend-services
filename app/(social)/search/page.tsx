import type { Metadata } from "next";
import { SearchScreen } from "./screen";

export const metadata: Metadata = { title: "Search · Ruxstar", robots: { index: false } };

export default function SearchPage() {
  return <SearchScreen />;
}
