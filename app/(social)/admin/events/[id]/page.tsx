import type { Metadata } from "next";
import { EventCaseScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Event · Ruxstar console", robots: { index: false } };

export default async function EventCasePage({ params }: Props) {
  const { id } = await params;
  return <EventCaseScreen key={id} id={id} />;
}
