import type { Metadata } from "next";
import { MessagesScreen } from "./screen";

export const metadata: Metadata = { title: "Messages · Ruxstar", robots: { index: false } };

export default function MessagesPage() {
  return <MessagesScreen />;
}
