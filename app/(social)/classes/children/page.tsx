import type { Metadata } from "next";
import { ChildrenScreen } from "./screen";

export const metadata: Metadata = { title: "Your children · Ruxstar", robots: { index: false } };

export default function ChildrenPage() {
  return <ChildrenScreen />;
}
