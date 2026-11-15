import type { Metadata } from "next";
import { DeskOrderScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Shop order · Ruxstar", robots: { index: false } };

export default async function DeskOrderPage({ params }: Props) {
  return <DeskOrderScreen id={(await params).id} />;
}
