import type { Metadata } from "next";
import { TeamOrdersScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Orders · Ruxstar", robots: { index: false } };

export default async function TeamOrdersPage({ params }: Props) {
  return <TeamOrdersScreen placeId={(await params).id} />;
}
