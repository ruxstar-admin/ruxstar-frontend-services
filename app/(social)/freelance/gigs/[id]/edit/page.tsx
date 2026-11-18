import type { Metadata } from "next";
import { GigEditor } from "@/components/gigs/GigEditor";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Edit gig · Ruxstar", robots: { index: false } };

export default async function EditGigPage({ params }: Props) {
  const { id } = await params;
  return <GigEditor key={id} id={id} />;
}
