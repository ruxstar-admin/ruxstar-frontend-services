import type { Metadata } from "next";
import { DeskOrdersScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Shop orders · Ruxstar", robots: { index: false } };

export default async function DeskOrdersPage({ params }: Props) {
  return <DeskOrdersScreen id={(await params).id} />;
}
