import type { Metadata } from "next";
import { TeamOrderScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Order · Ruxstar", robots: { index: false } };

export default async function TeamOrderPage({ params }: Props) {
  return <TeamOrderScreen id={(await params).id} />;
}
