import type { Metadata } from "next";
import { SendOfferScreen } from "./screen";

type Props = { searchParams: Promise<{ chat?: string; name?: string }> };

export const metadata: Metadata = { title: "Send an offer · Ruxstar", robots: { index: false } };

/** Opened from a 1:1 chat: `chat` is its id, `name` the person it's for. */
export default async function SendOfferPage({ searchParams }: Props) {
  const { chat, name } = await searchParams;
  return <SendOfferScreen chatId={chat && /^[a-f\d]{24}$/i.test(chat) ? chat : null} name={name?.slice(0, 80) ?? ""} />;
}
