import type { Metadata } from "next";
import { GroundForm } from "@/components/turf/GroundForm";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Edit ground · Ruxstar", robots: { index: false } };

export default async function EditGroundPage({ params }: Props) {
  return <GroundForm groundId={(await params).id} />;
}
