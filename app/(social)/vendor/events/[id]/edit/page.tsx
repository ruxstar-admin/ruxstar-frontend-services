import type { Metadata } from "next";
import { EventForm } from "@/components/events/EventForm";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Edit event · Ruxstar", robots: { index: false } };

export default async function EditEventPage({ params }: Props) {
  return <EventForm eventId={(await params).id} />;
}
