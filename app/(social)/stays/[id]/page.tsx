import type { Metadata } from "next";
import { cache } from "react";
import { fetchListingReviews } from "@/lib/api/reviews";
import { fetchPublicProperty } from "@/lib/api/stays";
import { FOR_SHORT, KIND_LABEL, priceFromText } from "@/lib/stays";
import { PropertyScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

/** The property is the same for everyone, so the page is cached; which beds are free loads in the browser. */
export const revalidate = 60;

/** None at build time: each property page is made on its first visit, then cached for `revalidate` seconds. */
export async function generateStaticParams(): Promise<{ id: string }[]> {
  return [];
}

/** Reviews that arrive with the page; "Show more reviews" loads the rest in the browser. */
const FIRST_REVIEWS = 5;

/** Shared by the page and its metadata, so a visit makes one API call. */
const load = cache(fetchPublicProperty);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const property = await load((await params).id);
  if (!property) return { title: "PG or hostel · Ruxstar", robots: { index: false } };
  const title = `${property.name} · Ruxstar`;
  const where = [property.area, property.city].filter(Boolean).join(", ");
  const description = `${KIND_LABEL[property.kind]} in ${where}, ${FOR_SHORT[property.for].toLowerCase()}. ${priceFromText(property.priceFrom)}. Reserve with ${property.business.name}.`;
  const photo = property.photos[0] ?? property.photo;
  const images = photo ? [{ url: photo.url, width: photo.width, height: photo.height, alt: property.name }] : undefined;
  return {
    title,
    description,
    alternates: { canonical: `/stays/${property.id}` },
    openGraph: { type: "website", siteName: "Ruxstar", url: `/stays/${property.id}`, title, description, images },
    twitter: { card: photo ? "summary_large_image" : "summary", title, description },
  };
}

export default async function PropertyPage({ params }: Props) {
  const { id } = await params;
  const [property, reviews] = await Promise.all([load(id), fetchListingReviews("stays", id, FIRST_REVIEWS)]);
  return <PropertyScreen id={id} initial={property} reviews={property ? reviews : null} />;
}
