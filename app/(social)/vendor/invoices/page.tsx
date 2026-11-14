import type { Metadata } from "next";
import { VendorInvoicesScreen } from "./screen";

export const metadata: Metadata = { title: "Invoices · Vendor portal · Ruxstar", robots: { index: false } };

export default function VendorInvoicesPage() {
  return <VendorInvoicesScreen />;
}
