import type { Metadata } from "next";
import { ThreadScreen } from "./thread";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Chat · Ruxstar", robots: { index: false } };

export default async function ThreadPage({ params }: Props) {
  return <ThreadScreen id={(await params).id} />;
}
