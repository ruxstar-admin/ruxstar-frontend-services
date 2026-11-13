import type { Metadata } from "next";
import { ReplyReviews } from "@/components/reviews/ReplyReviews";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Reviews · Ruxstar", robots: { index: false } };

export default async function BusinessReviewsPage({ params }: Props) {
  return <ReplyReviews id={(await params).id} />;
}
