import type { Metadata } from "next";
import { InvoicesScreen } from "./screen";

export const metadata: Metadata = { title: "Your invoices · Ruxstar", robots: { index: false } };

export default function InvoicesPage() {
  return <InvoicesScreen />;
}
