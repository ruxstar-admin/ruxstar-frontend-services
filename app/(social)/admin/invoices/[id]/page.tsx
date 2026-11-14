import type { Metadata } from "next";
import { Needs } from "@/components/admin/AdminFrame";
import { InvoiceScreen } from "@/components/invoices/InvoiceScreen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Invoice · Ruxstar console", robots: { index: false } };

export default async function InvoiceCasePage({ params }: Props) {
  const { id } = await params;
  return (
    <Needs need="orders.view">
      <InvoiceScreen key={id} id={id} audience="staff" />
    </Needs>
  );
}
