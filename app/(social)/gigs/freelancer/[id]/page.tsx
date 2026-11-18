import type { Metadata } from "next";
import { cache } from "react";
import { fetchPublicFreelancer } from "@/lib/api/gigs";
import { FreelancerScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

/** The page is the same for everyone, so it's cached. */
export const revalidate = 60;

/** None at build time: each freelancer's page is made on its first visit, then cached for `revalidate` seconds. */
export async function generateStaticParams(): Promise<{ id: string }[]> {
  return [];
}

/** Shared by the page and its metadata, so a visit makes one API call. */
const load = cache(fetchPublicFreelancer);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await load((await params).id);
  if (!page) return { title: "Freelancer · Ruxstar", robots: { index: false } };
  const title = `${page.name} · Ruxstar`;
  const description = [page.headline, [page.categoryLabel, page.city].filter(Boolean).join(" in ")].filter(Boolean).join(". ");
  const images = page.avatarUrl ? [{ url: page.avatarUrl, alt: page.name }] : undefined;
  return {
    title,
    description,
    alternates: { canonical: `/gigs/freelancer/${page.businessId}` },
    openGraph: { type: "profile", siteName: "Ruxstar", url: `/gigs/freelancer/${page.businessId}`, title, description, images },
    twitter: { card: "summary", title, description },
  };
}

export default async function FreelancerPage({ params }: Props) {
  const { id } = await params;
  return <FreelancerScreen key={id} id={id} initial={await load(id)} />;
}
