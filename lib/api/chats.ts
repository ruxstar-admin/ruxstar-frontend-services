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
};

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

/** `since` is the server's `now` from the last answer, so a computer clock that is off never skips messages. */
export const chatUpdates = async (id: string, since: string) =>
  (await signedIn(() => unwrap(api.GET("/v1/social/chats/{id}/updates", { params: { path: { id }, query: { since } } })))).data;

export const sendMessage = async (id: string, body: { text?: string; postId?: string }, key: string) =>
  (await signedIn(() => unwrap(api.POST("/v1/social/chats/{id}/messages", { ...chat(id), body, ...keyed(key) })))).data;

/** The spec has no body for this route (it is the raw image), so it skips the typed client. */
async function postPhoto(id: string, photo: Blob, key: string): Promise<Message> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/v1/social/chats/${id}/photos`, {
      method: "POST",
      credentials: "include",
      headers: { "X-Client": "web", "Content-Type": photo.type, "Idempotency-Key": key },
      body: photo,
    });
  } catch {
    throw new ApiError(0, "NETWORK", "The photo didn't send. Check your connection and try again.");
  }
  const body = (await response.json().catch(() => null)) as { data?: Message; error?: ApiErrorBody } | null;
  if (response.ok && body?.data) return body.data;
  if (body?.error) throw new ApiError(response.status, body.error.code, body.error.message, body.error.details);
  throw new ApiError(response.status, "INTERNAL", "Something went wrong on our side.");
}

export const sendPhoto = (id: string, photo: Blob, key: string) => signedIn(() => postPhoto(id, photo, key));

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
