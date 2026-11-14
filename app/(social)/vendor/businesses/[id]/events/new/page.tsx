import type { Metadata } from "next";
import { EventForm } from "@/components/events/EventForm";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "New event · Ruxstar", robots: { index: false } };

export default async function NewEventPage({ params }: Props) {
  return <EventForm businessId={(await params).id} />;
}
