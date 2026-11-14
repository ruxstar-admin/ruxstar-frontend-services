import type { Metadata } from "next";
import { GstScreen } from "./screen";

export const metadata: Metadata = { title: "GST · Ruxstar console", robots: { index: false } };

export default function GstPage() {
  return <GstScreen />;
}
