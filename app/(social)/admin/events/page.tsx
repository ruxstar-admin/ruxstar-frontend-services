import type { Metadata } from "next";
import { EventsScreen } from "./screen";

export const metadata: Metadata = { title: "Events · Ruxstar console", robots: { index: false } };

export default function EventsPage() {
  return <EventsScreen />;
}
