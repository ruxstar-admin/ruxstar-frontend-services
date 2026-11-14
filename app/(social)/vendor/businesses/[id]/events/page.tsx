import type { Metadata } from "next";
import { BusinessEventsScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Events · Ruxstar", robots: { index: false } };

export default async function BusinessEventsPage({ params }: Props) {
  return <BusinessEventsScreen id={(await params).id} />;
}
