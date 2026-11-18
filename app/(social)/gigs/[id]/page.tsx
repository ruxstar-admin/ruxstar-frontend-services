import type { Metadata } from "next";
import { cache } from "react";
import { fetchPublicGig } from "@/lib/api/gigs";
import { fetchListingReviews } from "@/lib/api/reviews";
import { cardPriceLine } from "@/lib/gigs";
import { GigScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

/** The gig is the same for everyone, so the page is cached. */
export const revalidate = 60;

/** None at build time: each gig page is made on its first visit, then cached for `revalidate` seconds. */
export async function generateStaticParams(): Promise<{ id: string }[]> {
  return [];
}

/** Reviews that arrive with the page; "Show more reviews" loads the rest in the browser. */
const FIRST_REVIEWS = 5;

/** Shared by the page and its metadata, so a visit makes one API call. */
const load = cache(fetchPublicGig);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const gig = await load((await params).id);
  if (!gig) return { title: "Gig · Ruxstar", robots: { index: false } };
  const title = `${gig.title} · Ruxstar`;
  const description = `${gig.categoryLabel} by ${gig.freelancer.name}${gig.freelancer.city ? ` in ${gig.freelancer.city}` : ""}. ${cardPriceLine(gig)}.`;
  const photo = gig.photos[0] ?? gig.photo;
  const images = photo ? [{ url: photo.url, width: photo.width, height: photo.height, alt: gig.title }] : undefined;
  return {
    title,
    description,
    alternates: { canonical: `/gigs/${gig.id}` },
    openGraph: { type: "website", siteName: "Ruxstar", url: `/gigs/${gig.id}`, title, description, images },
    twitter: { card: photo ? "summary_large_image" : "summary", title, description },
  };
}

export default async function GigPage({ params }: Props) {
  const { id } = await params;
  const [gig, reviews] = await Promise.all([load(id), fetchListingReviews("gigs", id, FIRST_REVIEWS)]);
  return <GigScreen key={id} id={id} initial={gig} reviews={gig ? reviews : null} />;
}
