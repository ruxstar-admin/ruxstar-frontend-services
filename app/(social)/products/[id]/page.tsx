import type { Metadata } from "next";
import { cache } from "react";
import { money } from "@/lib/api/shops";
import { fetchProductReviews, fetchPublicProduct } from "@/lib/api/store";
import { ProductScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

/** The product is the same for everyone, so the page is cached; signed in, it is fetched again for live stock. */
export const revalidate = 60;

export async function generateStaticParams(): Promise<{ id: string }[]> {
  return [];
}

const FIRST_REVIEWS = 5;

const load = cache(fetchPublicProduct);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await load((await params).id);
  if (!product) return { title: "Product · Ruxstar", robots: { index: false } };
  const title = `${product.title} · ${product.business.name} · Ruxstar`;
  const description = `${money(product.priceFrom)}${product.mrpFrom && product.mrpFrom > product.priceFrom ? ` (MRP ${money(product.mrpFrom)})` : ""} at ${product.business.name}, ${product.city}. ${product.inStock ? "In stock" : "Sold out"}. ${product.returnRule}`;
  const images = product.photo ? [{ url: product.photo.url, width: product.photo.width, height: product.photo.height, alt: product.title }] : undefined;
  return {
    title,
    description,
    alternates: { canonical: `/products/${product.id}` },
    openGraph: { type: "website", siteName: "Ruxstar", url: `/products/${product.id}`, title, description, images },
    twitter: { card: product.photo ? "summary_large_image" : "summary", title, description },
  };
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  const [product, reviews] = await Promise.all([load(id), fetchProductReviews(id, FIRST_REVIEWS)]);
  return <ProductScreen id={id} initial={product} reviews={product ? reviews : null} />;
}
