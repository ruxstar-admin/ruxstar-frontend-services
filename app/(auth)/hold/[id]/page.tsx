import type { Metadata } from "next";
import { TicketThread } from "@/components/support/TicketThread";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Help ticket · Ruxstar" };

export default async function HoldTicketPage({ params }: Props) {
  return <TicketThread hold id={(await params).id} />;
}
