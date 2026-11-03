import type { Metadata } from "next";
import { NotificationsScreen } from "./screen";

export const metadata: Metadata = { title: "Notifications · Ruxstar", robots: { index: false } };

export default function NotificationsPage() {
  return <NotificationsScreen />;
}
