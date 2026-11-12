import type { Metadata } from "next";
import { PodProductsScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Products & delivery · Ruxstar", robots: { index: false } };

export default async function PodProductsPage({ params }: Props) {
  return <PodProductsScreen id={(await params).id} />;
}
