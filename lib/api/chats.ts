import { signedIn } from "./account";
import { api, API_URL, ApiError, unwrap, type ApiErrorBody } from "./client";
import type { paths } from "./schema";
import type { Page } from "./social";

type Ok<P extends keyof paths, M extends keyof paths[P], S extends number = 200> = paths[P][M] extends {
  responses: Record<S, { content: { "application/json": { data: infer D } } }>;
}
  ? D
  : never;

export type Chat = Ok<"/v1/social/chats", "get">[number];
export type ChatDetail = Ok<"/v1/social/chats/{id}", "get">;
export type ChatPerson = ChatDetail["people"][number];
export type Message = Ok<"/v1/social/chats/{id}/messages", "get">[number];
export type ChatUpdates = Ok<"/v1/social/chats/{id}/updates", "get">;
export type ChatUnread = Ok<"/v1/social/chats/unread", "get">;
export type ChatBox = "chats" | "requests";

/** A message on screen: one from the server, or one of yours still sending or failed. */
export type ShownMessage = Message & {
  sendState?: "sending" | "failed";
  /** Reused on retry, so a message is never sent twice. */
  key?: string;
  /** A photo you are sending, shown from the file until the server has it. */
  upload?: { url: string; width: number; height: number };
  /** A voice message you are sending, played from the recording until the server has it. */
  recording?: { url: string; durationMs: number; levels: number[] };
};
export type ReplyPreview = NonNullable<Message["replyTo"]>;
export type ReactionCount = Message["reactions"][number];
export type Typist = ChatUpdates["typing"][number];

export const MESSAGE_TEXT_MAX = 1000;
export const GROUP_TITLE_MAX = 60;
/** Everyone in a group, you included, and anyone still deciding on an invite. */
export const GROUP_MAX = 50;
/** The API keeps chat photos at 1280 px on the long side. */
export const CHAT_PHOTO_SIDE = 1280;

const toPage = <T>(envelope: { data: T[]; meta: { nextCursor?: string | null } }): Page<T> => ({
  items: envelope.data,
  nextCursor: envelope.meta.nextCursor ?? null,
});

const chat = (id: string) => ({ params: { path: { id } } });
const keyed = (key: string) => ({ headers: { "Idempotency-Key": key } });

export const chatList = async (box: ChatBox, cursor?: string, limit?: number) =>
  toPage(await signedIn(() => unwrap(api.GET("/v1/social/chats", { params: { query: { box, cursor, limit } } }))));

/** Unread messages in chats that aren't muted, and requests waiting. */
export const chatUnread = async () => (await signedIn(() => unwrap(api.GET("/v1/social/chats/unread")))).data;

export const getChat = async (id: string) => (await signedIn(() => unwrap(api.GET("/v1/social/chats/{id}", chat(id))))).data;

/** Newest first. */
export const chatMessages = async (id: string, cursor?: string) =>
  toPage(await signedIn(() => unwrap(api.GET("/v1/social/chats/{id}/messages", { params: { path: { id }, query: { cursor } } }))));

/** How long an /updates call may wait for something to happen before answering empty. */
export const UPDATES_WAIT_S = 20;

/**
 * `since` is the server's `now` from the last answer, so a computer clock that is off never skips messages.
 * With `wait`, the API holds the call until something changes (a message, a reaction, typing, Seen) or that
 * many seconds pass.
 */
export const chatUpdates = async (id: string, since: string, wait = 0, signal?: AbortSignal) =>
  (await signedIn(() => unwrap(api.GET("/v1/social/chats/{id}/updates", { params: { path: { id }, query: { since, wait } }, signal })))).data;

export const sendMessage = async (id: string, body: { text?: string; postId?: string; replyToId?: string }, key: string) =>
  (await signedIn(() => unwrap(api.POST("/v1/social/chats/{id}/messages", { ...chat(id), body, ...keyed(key) })))).data;

/** The spec has no body for these routes (the raw image or recording), so they skip the typed client. */
async function postFile(path: string, file: Blob, key: string, query: Record<string, string | undefined>, failed: string): Promise<Message> {
  const search = new URLSearchParams(Object.entries(query).filter((e): e is [string, string] => e[1] !== undefined));
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}${search.size ? `?${search}` : ""}`, {
      method: "POST",
      credentials: "include",
      headers: { "X-Client": "web", "Content-Type": file.type, "Idempotency-Key": key },
      body: file,
    });
  } catch {
    throw new ApiError(0, "NETWORK", failed);
  }
  const body = (await response.json().catch(() => null)) as { data?: Message; error?: ApiErrorBody } | null;
  if (response.ok && body?.data) return body.data;
  if (body?.error) throw new ApiError(response.status, body.error.code, body.error.message, body.error.details);
  throw new ApiError(response.status, "INTERNAL", "Something went wrong on our side.");
}

export const sendPhoto = (id: string, photo: Blob, key: string, replyToId?: string) =>
  signedIn(() => postFile(`/v1/social/chats/${id}/photos`, photo, key, { replyToId }, "The photo didn't send. Check your connection and try again."));

/** `audio` must be AAC in MP4 (audio/mp4), so it plays on iPhones too. */
export const sendVoice = (id: string, audio: Blob, voice: { durationMs: number; levels: number[] }, key: string, replyToId?: string) =>
  signedIn(() =>
    postFile(
      `/v1/social/chats/${id}/voice`,
      new Blob([audio], { type: "audio/mp4" }),
      key,
      { durationMs: String(Math.round(voice.durationMs)), levels: voice.levels.length ? voice.levels.join(",") : undefined, replyToId },
      "The voice message didn't send. Check your connection and try again.",
    ),
  );

/** One reaction per person: reacting again swaps it. Answers with the message as it is now. */
export const reactTo = async (id: string, messageId: string, emoji: string) =>
  (await signedIn(() => unwrap(api.PUT("/v1/social/chats/{id}/messages/{messageId}/reaction", { params: { path: { id, messageId } }, body: { emoji } })))).data;

export const unreact = async (id: string, messageId: string) =>
  (await signedIn(() => unwrap(api.DELETE("/v1/social/chats/{id}/messages/{messageId}/reaction", { params: { path: { id, messageId } } })))).data;

/** Tell the others you're typing (again every few seconds while you keep going), or that you stopped. */
export const sendTyping = (id: string, typing: boolean) =>
  signedIn(() => unwrap(api.POST("/v1/social/chats/{id}/typing", { ...chat(id), body: { typing } })));

export const unsendMessage = (id: string, messageId: string) =>
  signedIn(() => unwrap(api.DELETE("/v1/social/chats/{id}/messages/{messageId}", { params: { path: { id, messageId } } })));

export const readChat = (id: string) => signedIn(() => unwrap(api.POST("/v1/social/chats/{id}/read", chat(id))));

export const acceptChat = async (id: string) => (await signedIn(() => unwrap(api.POST("/v1/social/chats/{id}/accept", chat(id))))).data;

export const declineChat = (id: string) => signedIn(() => unwrap(api.POST("/v1/social/chats/{id}/decline", chat(id))));

export const muteChat = (id: string, muted: boolean) => signedIn(() => unwrap(api.PUT("/v1/social/chats/{id}/mute", { ...chat(id), body: { muted } })));

/** The same chat every time for the same person. */
export const startDm = async (userId: string) => (await signedIn(() => unwrap(api.POST("/v1/social/chats/dm", { body: { userId } })))).data;

export const createGroup = async (title: string, userIds: string[]) =>
  (await signedIn(() => unwrap(api.POST("/v1/social/chats/groups", { body: { title, userIds } })))).data;

export const renameGroup = async (id: string, title: string) =>
  (await signedIn(() => unwrap(api.PATCH("/v1/social/chats/{id}", { ...chat(id), body: { title } })))).data;

export const addPeople = async (id: string, userIds: string[]) =>
  (await signedIn(() => unwrap(api.POST("/v1/social/chats/{id}/people", { ...chat(id), body: { userIds } })))).data;

export const removePerson = (id: string, userId: string) =>
  signedIn(() => unwrap(api.DELETE("/v1/social/chats/{id}/people/{userId}", { params: { path: { id, userId } } })));

export const makeAdmin = async (id: string, userId: string) =>
  (await signedIn(() => unwrap(api.PUT("/v1/social/chats/{id}/admins/{userId}", { params: { path: { id, userId } } })))).data;

export const leaveChat = (id: string) => signedIn(() => unwrap(api.POST("/v1/social/chats/{id}/leave", chat(id))));
