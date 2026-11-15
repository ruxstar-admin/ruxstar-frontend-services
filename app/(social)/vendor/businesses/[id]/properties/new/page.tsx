import type { Metadata } from "next";
import { PropertyForm } from "@/components/stays/PropertyForm";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "New property · Ruxstar", robots: { index: false } };

export default async function NewPropertyPage({ params }: Props) {
  return <PropertyForm businessId={(await params).id} />;
}
