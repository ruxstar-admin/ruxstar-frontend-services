import type { Metadata } from "next";
import { UserScreen } from "./screen";

export const metadata: Metadata = { title: "Account · Ruxstar console", robots: { index: false } };

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  return <UserScreen id={(await params).id} />;
}
