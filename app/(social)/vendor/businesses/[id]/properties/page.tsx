import type { Metadata } from "next";
import { BusinessPropertiesScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Properties · Ruxstar", robots: { index: false } };

export default async function BusinessPropertiesPage({ params }: Props) {
  return <BusinessPropertiesScreen id={(await params).id} />;
}
