import type { Metadata } from "next";
import { BatchForm } from "@/components/coaching/BatchForm";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "New batch · Ruxstar", robots: { index: false } };

export default async function NewBatchPage({ params }: Props) {
  return <BatchForm courseId={(await params).id} />;
}
