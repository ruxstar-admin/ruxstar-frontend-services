import type { Metadata } from "next";
import { cache } from "react";
import { fetchPublicEvent } from "@/lib/api/events";
import { fetchListingReviews } from "@/lib/api/reviews";
import { dayText, placeLine, priceLine, timeText } from "@/lib/events";
import { EventScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

/** The event itself is the same for everyone, so the page is cached; seats and your bookings load in the browser. */
export const revalidate = 60;

/** None at build time: each event page is made on its first visit, then cached for `revalidate` seconds. */
export async function generateStaticParams(): Promise<{ id: string }[]> {
  return [];
}

/** Reviews that arrive with the page; "Show more reviews" loads the rest in the browser. */
const FIRST_REVIEWS = 5;

/** Shared by the page and its metadata, so a visit makes one API call. */
const load = cache(fetchPublicEvent);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = await load((await params).id);
  if (!event) return { title: "Event · Ruxstar", robots: { index: false } };
  const title = `${event.title} · Ruxstar`;
  const place = placeLine(event);
  const description = `${dayText(event.startsAt)}, ${timeText(event.startsAt)}${place ? ` · ${place}` : ""}. ${priceLine(event)}. By ${event.business.name}.`;
  const images = event.photo ? [{ url: event.photo.url, width: event.photo.width, height: event.photo.height, alt: event.title }] : undefined;
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
  const [event, reviews] = await Promise.all([load(id), fetchListingReviews("events", id, FIRST_REVIEWS)]);
  return <EventScreen id={id} initial={event} reviews={event ? reviews : null} />;
}
