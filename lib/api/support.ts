import { signedIn } from "./account";
import { API_URL, ApiError, api, newIdempotencyKey, unwrap, type ApiErrorBody } from "./client";
import type { paths } from "./schema";
import type { Page } from "./social";

type Json<P extends keyof paths, M extends keyof paths[P]> = paths[P][M] extends {
  responses: { 200: { content: { "application/json": infer B } } };
}
  ? B
  : never;
type Query<P extends keyof paths> = paths[P] extends { get: { parameters: { query?: infer Q } } } ? NonNullable<Q> : never;

export type Ticket = Json<"/v1/support/tickets", "get">["data"][number];
export type TicketDetail = Json<"/v1/support/tickets/{id}", "get">["data"];
export type SupportMessage = TicketDetail["messages"][number];
export type SupportCategory = Ticket["category"];
export type SupportStatus = Ticket["status"];
export type NewTicket = paths["/v1/support/tickets"]["post"]["requestBody"]["content"]["application/json"];
export type ContextType = NonNullable<NewTicket["context"]>["type"];

export type StaffTicket = Json<"/v1/ruxstar/support/tickets", "get">["data"][number];
export type StaffTicketDetail = Json<"/v1/ruxstar/support/tickets/{id}", "get">["data"];
export type StaffMessage = StaffTicketDetail["messages"][number];
export type SupportPriority = StaffTicket["priority"];
export type QueueFilter = Omit<Query<"/v1/ruxstar/support/tickets">, "cursor" | "limit">;
export type QueueStatus = NonNullable<QueueFilter["status"]>;
export type StaffReply = paths["/v1/ruxstar/support/tickets/{id}/messages"]["post"]["requestBody"]["content"]["application/json"];
export type TicketPatch = paths["/v1/ruxstar/support/tickets/{id}"]["patch"]["requestBody"]["content"]["application/json"];
export type SupportAgent = Json<"/v1/ruxstar/support/agents", "get">["data"][number];
export type SupportSettings = Json<"/v1/ruxstar/support/settings", "get">["data"];
export type SlaHours = SupportSettings["hours"];

const toPage = <T>(envelope: { data: T[]; meta: { nextCursor?: string | null } }): Page<T> => ({
  items: envelope.data,
  nextCursor: envelope.meta.nextCursor ?? null,
});
const keyed = (key: string) => ({ "Idempotency-Key": key });

// The support pass.

/** What a sign-in answers for an account on hold: a 2-hour pass that only opens help tickets. */
export interface SupportPass {
  token: string;
  expiresAt: string;
  message: string;
}

/** Kept in memory only: it opens nothing but help tickets, and signing in again gives a fresh one. */
let held: SupportPass | null = null;
export const getSupportPass = () => held;
export const setSupportPass = (pass: SupportPass | null) => {
  held = pass;
};

/** The pass a sign-in hands back for an account on hold, or null for any other failure. */
export function holdPassOf(err: unknown): SupportPass | null {
  if (!(err instanceof ApiError) || err.code !== "ACCOUNT_ON_HOLD") return null;
  const detail = (err.details as { message?: string; supportToken?: unknown; expiresAt?: unknown }[]).find((d) => typeof d.supportToken === "string");
  if (!detail) return null;
  return { token: detail.supportToken as string, expiresAt: String(detail.expiresAt ?? ""), message: detail.message || err.message };
}

/**
 * Who a help call is for. With a pass (an account on hold, signed out) it goes as the bearer token; without, the
 * cookie session, refreshed once if it has expired.
 */
const as = <T>(pass: string | undefined, call: (headers: Record<string, string>) => Promise<T>) =>
  pass ? call({ Authorization: `Bearer ${pass}` }) : signedIn(() => call({}));

// Your tickets.

export const listTickets = async (pass: string | undefined, cursor?: string) =>
  toPage(await as(pass, (headers) => unwrap(api.GET("/v1/support/tickets", { params: { query: { cursor } }, headers }))));

/** Opening it marks Ruxstar's replies read. */
export const getTicket = async (pass: string | undefined, id: string) =>
  (await as(pass, (headers) => unwrap(api.GET("/v1/support/tickets/{id}", { params: { path: { id } }, headers })))).data;

/** Up to 5 open at once. A context must be yours, except a post. */
export const createTicket = async (pass: string | undefined, body: NewTicket, key = newIdempotencyKey()) =>
  (await as(pass, (headers) => unwrap(api.POST("/v1/support/tickets", { body, headers: { ...headers, ...keyed(key) } })))).data;

/** Replying to a resolved ticket reopens it, for 7 days. */
export const replyToTicket = async (pass: string | undefined, id: string, text: string, key = newIdempotencyKey()) =>
  (
    await as(pass, (headers) =>
      unwrap(api.POST("/v1/support/tickets/{id}/messages", { params: { path: { id } }, body: { text }, headers: { ...headers, ...keyed(key) } })),
    )
  ).data;

export const resolveTicket = async (pass: string | undefined, id: string, key = newIdempotencyKey()) =>
  (await as(pass, (headers) => unwrap(api.POST("/v1/support/tickets/{id}/resolve", { params: { path: { id } }, headers: { ...headers, ...keyed(key) } })))).data;

/** The spec has no body for this route (it is the raw image), so it skips the typed client. */
async function postPhoto(headers: Record<string, string>, id: string, messageId: string, photo: Blob, key: string): Promise<{ data: TicketDetail }> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/v1/support/tickets/${id}/messages/${messageId}/photos`, {
      method: "POST",
      credentials: "include",
      headers: { ...headers, "X-Client": "web", "Content-Type": photo.type, "Idempotency-Key": key },
      body: photo,
    });
  } catch {
    throw new ApiError(0, "NETWORK", "The photo didn't upload. Check your connection and try again.");
  }
  const body = (await response.json().catch(() => null)) as { data?: TicketDetail; error?: ApiErrorBody } | null;
  if (response.ok && body?.data) return { data: body.data };
  if (body?.error) throw new ApiError(response.status, body.error.code, body.error.message, body.error.details);
  throw new ApiError(response.status, "INTERNAL", "Something went wrong on our side.");
}

/** A photo on your own message, up to 3, within 30 minutes of sending it. */
export const addTicketPhoto = async (pass: string | undefined, id: string, messageId: string, photo: Blob, key = newIdempotencyKey()) =>
  (await as(pass, (headers) => postPhoto(headers, id, messageId, photo, key))).data;

// The console's help desk.

export const supportQueue = async (filter: QueueFilter, cursor?: string) =>
  toPage(await signedIn(() => unwrap(api.GET("/v1/ruxstar/support/tickets", { params: { query: { ...filter, cursor } } }))));

export const supportSummary = async () => (await signedIn(() => unwrap(api.GET("/v1/ruxstar/support/summary")))).data;

export const supportAgents = async () => (await signedIn(() => unwrap(api.GET("/v1/ruxstar/support/agents")))).data;

export const getStaffTicket = async (id: string) =>
  (await signedIn(() => unwrap(api.GET("/v1/ruxstar/support/tickets/{id}", { params: { path: { id } } })))).data;

/** A reply goes to the customer and the ticket waits on them; a note stays with the team. */
export const staffReply = async (id: string, body: StaffReply, key = newIdempotencyKey()) =>
  (await signedIn(() => unwrap(api.POST("/v1/ruxstar/support/tickets/{id}/messages", { params: { path: { id } }, body, headers: keyed(key) })))).data;

export const updateTicket = async (id: string, body: TicketPatch, key = newIdempotencyKey()) =>
  (await signedIn(() => unwrap(api.PATCH("/v1/ruxstar/support/tickets/{id}", { params: { path: { id } }, body, headers: keyed(key) })))).data;

export const getSupportSettings = async () => (await signedIn(() => unwrap(api.GET("/v1/ruxstar/support/settings")))).data;

export const saveSupportSettings = async (hours: SlaHours, key = newIdempotencyKey()) =>
  (await signedIn(() => unwrap(api.PUT("/v1/ruxstar/support/settings", { body: { hours }, headers: keyed(key) })))).data;

/** A verification case on hold after too many rejections gets one more try; the person is told. */
export const reopenKycCase = async (id: string, key = newIdempotencyKey()) =>
  (await signedIn(() => unwrap(api.POST("/v1/ruxstar/kyc/{id}/reopen", { params: { path: { id } }, headers: keyed(key) })))).data;
