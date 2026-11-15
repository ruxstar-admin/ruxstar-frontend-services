import type { Metadata } from "next";
import { StoreSetupScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Delivery & returns · Ruxstar", robots: { index: false } };

export default async function StoreSetupPage({ params }: Props) {
  return <StoreSetupScreen id={(await params).id} />;
}
