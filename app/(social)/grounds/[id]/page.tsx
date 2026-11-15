import type { Metadata } from "next";
import { cache } from "react";
import { fetchListingReviews } from "@/lib/api/reviews";
import { fetchPublicGround } from "@/lib/api/turf";
import { priceFromText } from "@/lib/turf";
import { GroundScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

/** The ground is the same for everyone, so the page is cached; free slots load on the booking page. */
export const revalidate = 60;

/** None at build time: each ground page is made on its first visit, then cached for `revalidate` seconds. */
export async function generateStaticParams(): Promise<{ id: string }[]> {
  return [];
}

/** Reviews that arrive with the page; "Show more reviews" loads the rest in the browser. */
const FIRST_REVIEWS = 5;

/** Shared by the page and its metadata, so a visit makes one API call. */
const load = cache(fetchPublicGround);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const ground = await load((await params).id);
  if (!ground) return { title: "Ground · Ruxstar", robots: { index: false } };
  const title = `${ground.name} · Ruxstar`;
  const sports = ground.sports.map((s) => s.name).join(", ");
  const description = `${sports ? `${sports} in ` : ""}${ground.city}. ${priceFromText(ground.priceFrom)}. Book a slot with ${ground.business.name}.`;
  const photo = ground.photos[0] ?? ground.photo;
  const images = photo ? [{ url: photo.url, width: photo.width, height: photo.height, alt: ground.name }] : undefined;
  return {
    title,
    description,
    alternates: { canonical: `/grounds/${ground.id}` },
    openGraph: { type: "website", siteName: "Ruxstar", url: `/grounds/${ground.id}`, title, description, images },
    twitter: { card: photo ? "summary_large_image" : "summary", title, description },
  };
}

export default async function GroundPage({ params }: Props) {
  const { id } = await params;
  const [ground, reviews] = await Promise.all([load(id), fetchListingReviews("turf", id, FIRST_REVIEWS)]);
  return <GroundScreen id={id} initial={ground} reviews={ground ? reviews : null} />;
}
