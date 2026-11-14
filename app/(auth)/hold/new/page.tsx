import type { Metadata } from "next";
import { NewTicket, type NewTicketParams } from "@/components/support/NewTicket";

type Props = { searchParams: Promise<NewTicketParams> };

export const metadata: Metadata = { title: "Message support · Ruxstar" };

export default async function HoldNewTicketPage({ searchParams }: Props) {
  return <NewTicket hold params={await searchParams} />;
}
