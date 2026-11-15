import type { Metadata } from "next";
import { StoreOrdersScreen } from "./screen";

type Props = { searchParams: Promise<{ shop?: string | string[]; returns?: string | string[] }> };

export const metadata: Metadata = { title: "Shop orders · Ruxstar console", robots: { index: false } };

export default async function StoreOrdersPage({ searchParams }: Props) {
  const { shop, returns } = await searchParams;
  const id = typeof shop === "string" && /^[a-f0-9]{24}$/.test(shop) ? shop : undefined;
  return <StoreOrdersScreen shop={id} openReturns={returns === "open"} />;
}
