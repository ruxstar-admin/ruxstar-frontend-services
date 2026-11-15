import type { Metadata } from "next";
import { RoomForm } from "@/components/stays/RoomForm";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Add a room · Ruxstar", robots: { index: false } };

export default async function NewRoomPage({ params }: Props) {
  return <RoomForm propertyId={(await params).id} />;
}
