import type { Metadata } from "next";
import { InvoicesScreen } from "./screen";

export const metadata: Metadata = { title: "Invoices · Ruxstar console", robots: { index: false } };

type Props = { searchParams: Promise<{ orderNo?: string; business?: string }> };

export default async function InvoicesPage({ searchParams }: Props) {
  const { orderNo, business } = await searchParams;
  return (
    <InvoicesScreen
      initialOrderNo={/^\d{1,9}$/.test(orderNo ?? "") ? Number(orderNo) : undefined}
      business={/^[a-f0-9]{24}$/.test(business ?? "") ? business : undefined}
    />
  );
}
