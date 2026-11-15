import type { Metadata } from "next";
import { cache } from "react";
import { fetchPublicProducts, fetchPublicStore } from "@/lib/api/store";
import { methodsLine, storeTypeLabel } from "@/lib/store";
import { StoreScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

/** The shop and its first products are the same for everyone, so the page is cached; the cart lives in the browser. */
export const revalidate = 60;

/** None at build time: each shop page is made on its first visit, then cached for `revalidate` seconds. */
export async function generateStaticParams(): Promise<{ id: string }[]> {
  return [];
}

/** Products that arrive with the page; "Show more" loads the rest in the browser. */
const FIRST_PRODUCTS = 24;

/** Shared by the page and its metadata, so a visit makes one API call. */
const load = cache(fetchPublicStore);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const store = await load((await params).id);
  if (!store) return { title: "Shop · Ruxstar", robots: { index: false } };
  const title = `${store.name} · Ruxstar`;
  const where = [store.area, store.city].filter(Boolean).join(", ");
  const description = `${storeTypeLabel(store.type)} in ${where}. ${methodsLine(store.setup)}. ${store.returnRule}`;
  const photo = store.photos[0];
  const images = photo ? [{ url: photo.url, width: photo.width, height: photo.height, alt: store.name }] : undefined;
  return {
    title,
    description,
    alternates: { canonical: `/shops/${store.id}` },
    openGraph: { type: "website", siteName: "Ruxstar", url: `/shops/${store.id}`, title, description, images },
    twitter: { card: photo ? "summary_large_image" : "summary", title, description },
  };
}

export default async function StorePage({ params }: Props) {
  const { id } = await params;
  const [store, products] = await Promise.all([load(id), fetchPublicProducts(id, FIRST_PRODUCTS)]);
  return <StoreScreen id={id} initial={store} products={store ? products : null} />;
}
