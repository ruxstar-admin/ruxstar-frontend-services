import type { Metadata } from "next";
import { VerifyScreen } from "./screen";

export const metadata: Metadata = { title: "Verification · Ruxstar", robots: { index: false } };

export default function VerifyPage() {
  return <VerifyScreen />;
}
