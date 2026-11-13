import type { Metadata } from "next";
import { TeamPostScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Post as the business · Ruxstar", robots: { index: false } };

export default async function TeamPostPage({ params }: Props) {
  return <TeamPostScreen placeId={(await params).id} />;
}
