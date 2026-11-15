import type { Metadata } from "next";
import { DeskReservationScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Reservation · Ruxstar", robots: { index: false } };

export default async function DeskReservationPage({ params }: Props) {
  return <DeskReservationScreen id={(await params).id} />;
}
