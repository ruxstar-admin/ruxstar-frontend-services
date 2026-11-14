import type { Metadata } from "next";
import { TicketThread } from "@/components/support/TicketThread";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Help ticket · Ruxstar", robots: { index: false } };

export default async function TicketPage({ params }: Props) {
  return <TicketThread id={(await params).id} />;
}
