import type { Metadata } from "next";
import { DeskTenantsScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Tenants · Ruxstar", robots: { index: false } };

export default async function DeskTenantsPage({ params }: Props) {
  return <DeskTenantsScreen id={(await params).id} />;
}
