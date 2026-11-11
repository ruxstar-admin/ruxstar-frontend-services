import type { Metadata } from "next";
import { BusinessScreen } from "./screen";

export const metadata: Metadata = { title: "Business · Ruxstar console", robots: { index: false } };

export default async function BusinessPage({ params }: { params: Promise<{ id: string }> }) {
  return <BusinessScreen id={(await params).id} />;
}
