import type { Metadata } from "next";
import { StartChatScreen } from "./screen";

type Props = { params: Promise<{ userId: string }> };

export const metadata: Metadata = { title: "Chat · Ruxstar", robots: { index: false } };

export default async function StartChatPage({ params }: Props) {
  return <StartChatScreen userId={(await params).userId} />;
}
