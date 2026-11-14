import type { Metadata } from "next";
import { GuestListScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Guest list · Ruxstar", robots: { index: false } };

export default async function GuestListPage({ params }: Props) {
  return <GuestListScreen id={(await params).id} />;
}
