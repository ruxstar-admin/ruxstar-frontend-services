import type { Metadata } from "next";
import { PaymentsScreen } from "@/app/(social)/vendor/payments/screen";

export const metadata: Metadata = { title: "Payments · Freelancing · Ruxstar", robots: { index: false } };

/** The vendor portal's payments, for freelancers who aren't vendors. */
export default function FreelancePaymentsPage() {
  return <PaymentsScreen freelance />;
}
