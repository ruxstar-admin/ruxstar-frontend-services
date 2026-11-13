import type { Metadata } from "next";
import { ChatInfoScreen } from "./screen";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Chat details · Ruxstar", robots: { index: false } };

export default async function ChatInfoPage({ params }: Props) {
  return <ChatInfoScreen id={(await params).id} />;
}
