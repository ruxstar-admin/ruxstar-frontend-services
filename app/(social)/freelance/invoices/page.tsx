import type { Metadata } from "next";
import { VendorInvoicesScreen } from "@/app/(social)/vendor/invoices/screen";

export const metadata: Metadata = { title: "GST invoices · Freelancing · Ruxstar", robots: { index: false } };

/** The vendor portal's GST documents, for freelancers who can't open the portal. */
export default function FreelanceInvoicesPage() {
  return <VendorInvoicesScreen freelance />;
}
