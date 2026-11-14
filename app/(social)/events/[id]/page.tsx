import type { Metadata } from "next";
import { cache } from "react";
import { fetchPublicEvent } from "@/lib/api/events";
import { dayText, placeLine } from "@/lib/events";
import { EventScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

/** The event itself is the same for everyone, so the page is cached; seats and your bookings load in the browser. */
export const revalidate = 60;

/** None at build time: each event page is made on its first visit, then cached for `revalidate` seconds. */
export async function generateStaticParams(): Promise<{ id: string }[]> {
  return [];
}

/** Shared by the page and its metadata, so a visit makes one API call. */
const load = cache(fetchPublicEvent);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = await load((await params).id);
  if (!event) return { title: "Event · Ruxstar", robots: { index: false } };
  const title = `${event.title} · Ruxstar`;
  const description = `${dayText(event.startsAt)} · ${placeLine(event)}. By ${event.business.name}.`;
  const images = event.photo ? [{ url: event.photo.url, width: event.photo.width, height: event.photo.height, alt: "" }] : undefined;
  return {
    title,
    description,
    alternates: { canonical: `/events/${event.id}` },
    openGraph: { type: "website", siteName: "Ruxstar", url: `/events/${event.id}`, title, description, images },
    twitter: { card: event.photo ? "summary_large_image" : "summary", title, description },
  };
}

export default async function EventPage({ params }: Props) {
  const { id } = await params;
  return <EventScreen id={id} initial={await load(id)} />;
}
