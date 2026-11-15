import type { Metadata } from "next";
import { PropertyForm } from "@/components/stays/PropertyForm";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Edit the listing · Ruxstar", robots: { index: false } };

/** For wardens allowed to edit the listing; the owner edits from the property's setup. */
export default async function DeskListingPage({ params }: Props) {
  return <PropertyForm propertyId={(await params).id} desk />;
}
