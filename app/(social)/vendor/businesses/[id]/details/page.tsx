import type { Metadata } from "next";
import { BusinessDetailsScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Business details · Ruxstar", robots: { index: false } };

export default async function BusinessDetailsPage({ params }: Props) {
  return <BusinessDetailsScreen id={(await params).id} />;
}
