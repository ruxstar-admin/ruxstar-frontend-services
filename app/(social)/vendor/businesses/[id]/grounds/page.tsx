import type { Metadata } from "next";
import { BusinessGroundsScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Grounds · Ruxstar", robots: { index: false } };

export default async function BusinessGroundsPage({ params }: Props) {
  return <BusinessGroundsScreen id={(await params).id} />;
}
