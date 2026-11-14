import type { Metadata } from "next";
import { NewTicket, type NewTicketParams } from "@/components/support/NewTicket";

type Props = { searchParams: Promise<NewTicketParams> };

export const metadata: Metadata = { title: "Message support · Ruxstar", robots: { index: false } };

export default async function NewTicketPage({ searchParams }: Props) {
  return <NewTicket params={await searchParams} />;
}
