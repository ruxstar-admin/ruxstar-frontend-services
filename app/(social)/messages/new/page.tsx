import type { Metadata } from "next";
import { NewChatScreen } from "./screen";

type Props = { searchParams: Promise<{ add?: string; size?: string }> };

export const metadata: Metadata = { title: "New chat · Ruxstar", robots: { index: false } };

/** `?add={chatId}&size={people}` adds people to that group instead of starting a chat. */
export default async function NewChatPage({ searchParams }: Props) {
  const { add, size } = await searchParams;
  const addTo = add && /^[a-f0-9]{24}$/.test(add) ? { id: add, size: Number(size) || 1 } : null;
  return <NewChatScreen addTo={addTo} />;
}
