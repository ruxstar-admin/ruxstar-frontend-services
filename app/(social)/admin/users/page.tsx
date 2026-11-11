import type { Metadata } from "next";
import { UsersScreen } from "./screen";

export const metadata: Metadata = { title: "People · Ruxstar console", robots: { index: false } };

export default function UsersPage() {
  return <UsersScreen />;
}
