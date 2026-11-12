import type { Metadata } from "next";
import { PodPricesScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Prices · Ruxstar", robots: { index: false } };

export default async function PodPricesPage({ params }: Props) {
  return <PodPricesScreen id={(await params).id} />;
}
