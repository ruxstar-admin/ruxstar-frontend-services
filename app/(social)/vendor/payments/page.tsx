import type { Metadata } from "next";
import { PaymentsScreen } from "./screen";

export const metadata: Metadata = { title: "Payments · Ruxstar", robots: { index: false } };

export default function PaymentsPage() {
  return <PaymentsScreen />;
}
