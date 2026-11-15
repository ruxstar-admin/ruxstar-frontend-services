import type { Metadata } from "next";
import { DeskProductsScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Products & stock · Ruxstar", robots: { index: false } };

export default async function DeskProductsPage({ params }: Props) {
  return <DeskProductsScreen id={(await params).id} />;
}
