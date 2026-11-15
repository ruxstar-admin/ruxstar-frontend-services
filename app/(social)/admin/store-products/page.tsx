import type { Metadata } from "next";
import { StoreProductsScreen } from "./screen";

type Props = { searchParams: Promise<{ shop?: string | string[] }> };

export const metadata: Metadata = { title: "Shop products · Ruxstar console", robots: { index: false } };

export default async function StoreProductsPage({ searchParams }: Props) {
  const { shop } = await searchParams;
  const id = typeof shop === "string" && /^[a-f0-9]{24}$/.test(shop) ? shop : undefined;
  return <StoreProductsScreen shop={id} />;
}
