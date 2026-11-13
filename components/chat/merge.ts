import type { Message, ShownMessage } from "@/lib/api/chats";

/**
 * Adds messages the server returned that aren't on screen yet. Yours still sending stay last,
 * so a poll arriving mid-send never reorders the chat.
 */
export const mergeIncoming = (current: ShownMessage[], incoming: Message[]): ShownMessage[] => {
  const known = new Set(current.map((m) => m.id));
  const fresh = incoming.filter((m) => !known.has(m.id));
  if (fresh.length === 0) return current;
  return [...current.filter((m) => !m.sendState), ...fresh, ...current.filter((m) => m.sendState)];
};

/** Puts an older page (newest first, as the API sends it) before what is on screen. */
export const mergeOlder = (current: ShownMessage[], olderNewestFirst: Message[]): ShownMessage[] => {
  const known = new Set(current.map((m) => m.id));
  const older = olderNewestFirst.filter((m) => !known.has(m.id)).reverse();
  return older.length ? [...older, ...current] : current;
};

/** Swaps a message you sent for the server's copy, dropping it if a poll already brought that copy. */
export const confirmSent = (current: ShownMessage[], tempId: string, saved: Message): ShownMessage[] => {
  const rest = current.filter((m) => m.id !== tempId);
  return rest.some((m) => m.id === saved.id) ? rest : [...rest, saved];
};

export const dropUnsent = (current: ShownMessage[], ids: string[]): ShownMessage[] => {
  if (ids.length === 0) return current;
  const gone = new Set(ids);
  const kept = current.filter((m) => !gone.has(m.id));
  return kept.length === current.length ? current : kept;
};

/** The message to show "Seen" under: the latest one, when it is yours and they have read it since. */
export const seenMessageId = (messages: ShownMessage[], seenAt: string | null): string | null => {
  const last = messages.at(-1);
  if (!seenAt || !last || !last.mine || last.sendState || last.kind === "event") return null;
  return new Date(last.createdAt).getTime() <= new Date(seenAt).getTime() ? last.id : null;
};
