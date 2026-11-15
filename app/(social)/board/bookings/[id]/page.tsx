import type { Metadata } from "next";
import { DeskBookingScreen } from "./screen";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ cancel?: string }> };

export const metadata: Metadata = { title: "Booking · Ruxstar", robots: { index: false } };

export default async function DeskBookingPage({ params, searchParams }: Props) {
  const [{ id }, { cancel }] = await Promise.all([params, searchParams]);
  return <DeskBookingScreen id={id} cancel={cancel === "1"} />;
}
