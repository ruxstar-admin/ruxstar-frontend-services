import type { Metadata } from "next";
import { FeedScreen } from "./screen";

export const metadata: Metadata = { title: "Feed · Ruxstar", robots: { index: false } };

export default function FeedPage() {
  return <FeedScreen />;
}
