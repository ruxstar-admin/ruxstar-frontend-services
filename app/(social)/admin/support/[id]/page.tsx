import type { Metadata } from "next";
import { SupportTicketScreen } from "./screen";

export const metadata: Metadata = { title: "Help ticket · Ruxstar console", robots: { index: false } };

export default async function SupportTicketPage({ params }: { params: Promise<{ id: string }> }) {
  return <SupportTicketScreen id={(await params).id} />;
}
