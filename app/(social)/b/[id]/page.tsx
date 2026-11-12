import type { Metadata } from "next";
import { ShopScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Print shop · Ruxstar", robots: { index: false } };

export default async function ShopPage({ params }: Props) {
  return <ShopScreen id={(await params).id} />;
}
