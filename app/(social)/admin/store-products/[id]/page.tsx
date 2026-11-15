import type { Metadata } from "next";
import { StoreProductCaseScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Shop product · Ruxstar console", robots: { index: false } };

export default async function StoreProductCasePage({ params }: Props) {
  return <StoreProductCaseScreen id={(await params).id} />;
}
