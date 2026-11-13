import type { ReplyPreview, ShownMessage } from "@/lib/api/chats";

/** Where a bubble sits in a run of messages from one person, oldest first. */
export type BubblePosition = "single" | "first" | "middle" | "last";

export interface ThreadRow {
  message: ShownMessage;
  /** A time line above this message, e.g. "Today 14:05". */
  header: string | null;
  position: BubblePosition;
}

/** Messages further apart than this start a new run and get a time line, as on Instagram. */
const GAP_MS = 60 * 60_000;
/** Messages from one person closer than this share a run of joined bubbles. */
const RUN_MS = 5 * 60_000;
const DAY_MS = 24 * 60 * 60_000;

const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const clock = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/** "Today 14:05", "Yesterday 14:05", "Tue 14:05" this week, "12 Nov, 14:05" this year, "12 Nov 2025, 14:05" before. Same as the app. */
export function stampLabel(iso: string, now: number = Date.now()): string {
  const at = new Date(iso);
  const days = Math.round((startOfDay(now) - startOfDay(at.getTime())) / DAY_MS);
  if (days <= 0) return `Today ${clock(at)}`;
  if (days === 1) return `Yesterday ${clock(at)}`;
  if (days < 7) return `${at.toLocaleDateString("en-GB", { weekday: "short" })} ${clock(at)}`;
  const sameYear = at.getFullYear() === new Date(now).getFullYear();
  const date = at.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
  return `${date}, ${clock(at)}`;
}

/** "Active now" within 2 minutes, then "Active 5m ago", "Active 3h ago", "Active yesterday", "Active 3d ago"; nothing after a week. Same as the app. */
export function activeLabel(iso: string | null, now: number = Date.now()): string | null {
  if (!iso) return null;
  const minutes = Math.floor((now - Date.parse(iso)) / 60_000);
  if (minutes < 2) return "Active now";
  if (minutes < 60) return `Active ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Active ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Active yesterday";
  return days < 7 ? `Active ${days}d ago` : null;
}

/** A voice message's length: "0:07", "1:42". */
export const clockOf = (ms: number) => {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

/** What a reply shows of the message it answers, before the server has filled it in. */
export function quoteOf(m: ShownMessage): ReplyPreview {
  const text = m.kind === "photo" ? "Photo" : m.kind === "voice" ? "Voice message" : m.kind === "post" ? m.text || "Post" : m.text;
  return { id: m.id, available: true, sender: m.mine ? "You" : m.sender?.name || m.sender?.username || "Someone", mine: m.mine, kind: m.kind, text };
}

const senderOf = (m: ShownMessage) => (m.kind === "event" ? "#event" : m.mine ? "#me" : (m.sender?.id ?? "#unknown"));

/** Oldest first in, oldest first out: each message with its time line and its place in a run of bubbles. */
export function layoutThread(messages: ShownMessage[], now: number = Date.now()): ThreadRow[] {
  const headers = messages.map((m, i) => {
    const prev = messages[i - 1];
    if (!prev) return stampLabel(m.createdAt, now);
    const at = Date.parse(m.createdAt);
    const before = Date.parse(prev.createdAt);
    return startOfDay(at) !== startOfDay(before) || at - before >= GAP_MS ? stampLabel(m.createdAt, now) : null;
  });
  const joins = (a: ShownMessage | undefined, b: ShownMessage | undefined, bHeader: string | null) =>
    !!a && !!b && !bHeader && a.kind !== "event" && senderOf(a) === senderOf(b) && Date.parse(b.createdAt) - Date.parse(a.createdAt) < RUN_MS;

  return messages.map((message, i) => {
    const withPrev = joins(messages[i - 1], message, headers[i]);
    const withNext = joins(message, messages[i + 1], headers[i + 1] ?? null);
    const position: BubblePosition = withPrev ? (withNext ? "middle" : "last") : withNext ? "first" : "single";
    return { message, header: headers[i], position };
  });
}
