import type { Metadata } from "next";
import { CourtForm } from "@/components/turf/CourtForm";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Add a court · Ruxstar", robots: { index: false } };

export default async function NewCourtPage({ params }: Props) {
  return <CourtForm groundId={(await params).id} />;
}
