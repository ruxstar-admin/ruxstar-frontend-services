import type { Metadata } from "next";
import { PropertyForm } from "@/components/stays/PropertyForm";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Edit property · Ruxstar", robots: { index: false } };

export default async function EditPropertyPage({ params }: Props) {
  return <PropertyForm propertyId={(await params).id} />;
}
