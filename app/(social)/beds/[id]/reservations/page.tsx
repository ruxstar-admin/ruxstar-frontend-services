import type { Metadata } from "next";
import { DeskReservationsScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Reservations · Ruxstar", robots: { index: false } };

export default async function DeskReservationsPage({ params }: Props) {
  return <DeskReservationsScreen id={(await params).id} />;
}
