import type { Metadata } from "next";
import { PodPriceScreen } from "./screen";

type Props = { params: Promise<{ id: string; product: string }> };

export const metadata: Metadata = { title: "Price · Ruxstar", robots: { index: false } };

export default async function PodPricePage({ params }: Props) {
  const { id, product } = await params;
  return <PodPriceScreen id={id} product={product} />;
}
