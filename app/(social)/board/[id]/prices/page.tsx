import type { Metadata } from "next";
import { DeskPricesScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Prices · Ruxstar", robots: { index: false } };

export default async function DeskPricesPage({ params }: Props) {
  return <DeskPricesScreen id={(await params).id} />;
}
