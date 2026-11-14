import type { Metadata } from "next";
import { TicketOrderScreen } from "./screen";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ fresh?: string }> };

export const metadata: Metadata = { title: "Your tickets · Ruxstar", robots: { index: false } };

/** `?fresh=1` right after booking free tickets, to say they're going. */
export default async function TicketOrderPage({ params, searchParams }: Props) {
  const [{ id }, { fresh }] = await Promise.all([params, searchParams]);
  return <TicketOrderScreen id={id} fresh={fresh === "1"} />;
}
