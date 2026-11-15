import type { Metadata } from "next";
import { GroundForm } from "@/components/turf/GroundForm";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "New ground · Ruxstar", robots: { index: false } };

export default async function NewGroundPage({ params }: Props) {
  return <GroundForm businessId={(await params).id} />;
}
