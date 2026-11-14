import type { Metadata } from "next";
import { PaymentTermsScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Payment terms · Vendor portal", robots: { index: false } };

export default async function PaymentTermsPage({ params }: Props) {
  return <PaymentTermsScreen id={(await params).id} />;
}
