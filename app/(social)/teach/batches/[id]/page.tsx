import type { Metadata } from "next";
import { TeachBatchScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Batch · Ruxstar", robots: { index: false } };

export default async function TeachBatchPage({ params }: Props) {
  return <TeachBatchScreen id={(await params).id} />;
}
