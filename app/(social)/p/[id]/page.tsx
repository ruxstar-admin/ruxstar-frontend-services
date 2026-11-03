import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { fetchPublicPost } from "@/lib/api/social";
import { PostThread } from "./thread";

type Props = { params: Promise<{ id: string }> };

/** Shared by the page and its metadata, so a visit makes one API call. */
const load = cache(fetchPublicPost);

const excerpt = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await load((await params).id);
  if (!post) return { title: "Post not found · Ruxstar", robots: { index: false } };

  const { author } = post;
  const title = `${author.name} on Ruxstar${post.text ? `: "${excerpt(post.text, 60)}"` : ""}`;
  const description = post.text ? excerpt(post.text, 160) : `A post by ${author.name} (@${author.username}) on Ruxstar.`;
  const photo = post.media[0];
  const images = photo ? [{ url: photo.url, width: photo.width, height: photo.height, alt: "" }] : author.avatarUrl ? [{ url: author.avatarUrl, width: 512, height: 512, alt: author.name }] : undefined;
  return {
    title,
    description,
    alternates: { canonical: `/p/${post.id}` },
    openGraph: { type: "article", siteName: "Ruxstar", url: `/p/${post.id}`, title, description, images, publishedTime: post.createdAt },
    twitter: { card: photo ? "summary_large_image" : "summary", title, description },
  };
}

export default async function PostPage({ params }: Props) {
  const post = await load((await params).id);
  if (!post) notFound();
  return <PostThread initial={post} />;
}
