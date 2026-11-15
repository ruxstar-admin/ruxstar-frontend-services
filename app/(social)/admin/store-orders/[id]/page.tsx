import type { Metadata } from "next";
import { StoreOrderCaseScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Shop order · Ruxstar console", robots: { index: false } };

export default async function StoreOrderCasePage({ params }: Props) {
  return <StoreOrderCaseScreen id={(await params).id} />;
}
