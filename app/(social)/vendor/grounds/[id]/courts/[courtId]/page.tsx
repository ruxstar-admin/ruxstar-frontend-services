import type { Metadata } from "next";
import { CourtForm } from "@/components/turf/CourtForm";

type Props = { params: Promise<{ id: string; courtId: string }> };

export const metadata: Metadata = { title: "Court · Ruxstar", robots: { index: false } };

export default async function EditCourtPage({ params }: Props) {
  const { id, courtId } = await params;
  return <CourtForm groundId={id} courtId={courtId} />;
}
