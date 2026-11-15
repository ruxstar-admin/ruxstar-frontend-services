import type { Metadata } from "next";
import { DeskBookingsScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Bookings · Ruxstar", robots: { index: false } };

export default async function DeskBookingsPage({ params }: Props) {
  return <DeskBookingsScreen id={(await params).id} />;
}
