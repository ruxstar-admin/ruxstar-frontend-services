import type { Metadata } from "next";
import { BusinessScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Business · Ruxstar", robots: { index: false } };

export default async function BusinessPage({ params }: Props) {
  return <BusinessScreen id={(await params).id} />;
}
