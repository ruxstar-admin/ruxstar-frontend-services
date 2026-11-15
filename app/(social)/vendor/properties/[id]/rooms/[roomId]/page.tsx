import type { Metadata } from "next";
import { RoomForm } from "@/components/stays/RoomForm";

type Props = { params: Promise<{ id: string; roomId: string }> };

export const metadata: Metadata = { title: "Room · Ruxstar", robots: { index: false } };

export default async function RoomPage({ params }: Props) {
  const { id, roomId } = await params;
  return <RoomForm propertyId={id} roomId={roomId} />;
}
