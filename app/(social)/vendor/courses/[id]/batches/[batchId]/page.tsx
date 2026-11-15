import type { Metadata } from "next";
import { BatchForm } from "@/components/coaching/BatchForm";

type Props = { params: Promise<{ id: string; batchId: string }> };

export const metadata: Metadata = { title: "Edit batch · Ruxstar", robots: { index: false } };

export default async function EditBatchPage({ params }: Props) {
  const { id, batchId } = await params;
  return <BatchForm courseId={id} batchId={batchId} />;
}
