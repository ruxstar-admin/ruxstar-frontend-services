import type { Metadata } from "next";
import { InvoiceScreen } from "@/components/invoices/InvoiceScreen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Invoice · Ruxstar", robots: { index: false } };

export default async function InvoicePage({ params }: Props) {
  const { id } = await params;
  return <InvoiceScreen key={id} id={id} audience="customer" />;
}
