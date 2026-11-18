import { signedIn } from "./account";
import { API_URL, ApiError, type ApiErrorBody } from "./client";
import type { Message } from "./chats";
import type { Page } from "./social";
import type {
  ConsoleFreelancer,
  ConsoleGig,
  ConsoleGigOrdersQuery,
  ConsoleGigsQuery,
  DecideInput,
  DeliverInput,
  FileUse,
  FreelancerInput,
  FreelancerPage,
  FreelancerPatch,
  GigCard,
  GigDetail,
  GigInput,
  GigOffers,
  GigOrder,
  GigOrderInput,
  GigOrderStatus,
  GigPatch,
  GigsQuery,
  GigsRules,
  GigStatus,
  GigTier,
  MyFreelancer,
  MyGig,
  PlacedGigOrder,
  QuoteInput,
  QuotePayInput,
  QuoteState,
  UploadedFile,
} from "./gigs-types";

export type * from "./gigs-types";

type Query = Record<string, string | number | boolean | undefined>;
interface Call {
  query?: Query;
  body?: unknown;
  /** The raw file, sent as its own content type. */
  file?: Blob;
  key?: string;
}

/** A small typed fetch with the same headers, cookies and errors as `api`, which also sends raw photos and files. */
async function call<T>(method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE", path: string, { query, body, file, key }: Call = {}): Promise<T> {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(query ?? {})) if (value !== undefined && value !== "") search.set(name, String(value));
  const headers: Record<string, string> = { "X-Client": "web" };
  if (key) headers["Idempotency-Key"] = key;
  if (file) headers["Content-Type"] = file.type;
  else if (body !== undefined) headers["Content-Type"] = "application/json";
  const qs = search.toString();
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}${qs ? `?${qs}` : ""}`, {
      method,
      credentials: "include",
      headers,
      body: file ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch {
    throw new ApiError(0, "NETWORK", "You seem to be offline. Check your connection and try again.");
  }
  const parsed = (await response.json().catch(() => null)) as (T & { error?: ApiErrorBody }) | null;
  const requestId = response.headers.get("x-request-id");
  if (response.ok && parsed) return parsed;
  if (parsed?.error) throw new ApiError(response.status, parsed.error.code, parsed.error.message, parsed.error.details, requestId);
  throw new ApiError(response.status, "INTERNAL", "Something went wrong on our side.", [], requestId);
}

const one = async <T>(method: Parameters<typeof call>[0], path: string, options?: Call) =>
  (await signedIn(() => call<{ data: T }>(method, path, options))).data;
const list = async <T>(path: string, query?: Query): Promise<Page<T>> => {
  const envelope = await signedIn(() => call<{ data: T[]; meta: { nextCursor?: string | null } }>("GET", path, { query }));
  return { items: envelope.data, nextCursor: envelope.meta?.nextCursor ?? null };
};
const enc = encodeURIComponent;
const trimmed = (text: string | undefined) => text?.trim() || undefined;

// Finding a freelancer and ordering. These work signed out too, except ordering and paying.

export const gigsRules = () => one<GigsRules>("GET", "/v1/gigs/rules");

export const listGigs = (query: GigsQuery, cursor?: string, limit?: number) =>
  list<GigCard>("/v1/gigs/", { category: query.category, city: trimmed(query.city), q: trimmed(query.q), cursor, limit });

/** Its owner also sees a gig that isn't live. */
export const getGig = (id: string) => one<GigDetail>("GET", `/v1/gigs/${enc(id)}`);

export const getFreelancer = (businessId: string) => one<FreelancerPage>("GET", `/v1/gigs/freelancers/${enc(businessId)}`);

async function fetchPublic<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, { headers: { "X-Client": "web" }, next: { revalidate: 60 } });
    if (!res.ok) return null;
    return ((await res.json()) as { data: T }).data;
  } catch {
    return null;
  }
}

/** For the server: a live gig, cached for a minute. Null when it isn't there; the page then loads it in the browser. */
export async function fetchPublicGig(id: string): Promise<GigDetail | null> {
  if (!/^[a-f0-9]{24}$/.test(id)) return null;
  const gig = await fetchPublic<GigDetail>(`/v1/gigs/${id}`);
  return gig?.status === "live" ? gig : null;
}

/** For the server: a freelancer's page, cached for a minute. */
export async function fetchPublicFreelancer(id: string): Promise<FreelancerPage | null> {
  if (!/^[a-f0-9]{24}$/.test(id)) return null;
  return fetchPublic<FreelancerPage>(`/v1/gigs/freelancers/${id}`);
}

/** Coupons for one package; with `code`, that code is checked too. */
export const gigOffers = (gigId: string, tier: GigTier, code?: string) => one<GigOffers>("GET", `/v1/gigs/${enc(gigId)}/offers`, { query: { tier, code } });

/** Pass the same key when retrying the same click. */
export const placeGigOrder = (gigId: string, body: GigOrderInput, key: string) => one<PlacedGigOrder>("POST", `/v1/gigs/${enc(gigId)}/order`, { body, key });

/** A custom offer sent to you in a chat. */
export const getQuote = (quoteId: string) => one<QuoteState>("GET", `/v1/gigs/quotes/${enc(quoteId)}`);

/** Coupons for an offer you were sent; with `code`, that code is checked too. */
export const quoteOffers = (quoteId: string, code?: string) => one<GigOffers>("GET", `/v1/gigs/quotes/${enc(quoteId)}/offers`, { query: { code } });

/** Makes an order the freelancer has accepted already. */
export const payQuote = (quoteId: string, body: QuotePayInput, key: string) => one<PlacedGigOrder>("POST", `/v1/gigs/quotes/${enc(quoteId)}/pay`, { body, key });

/** Any file type the API allows, sent as it is; the name's extension decides its type. */
export const uploadGigFile = (file: File, use: FileUse, key: string) =>
  one<UploadedFile>("POST", "/v1/gigs/files", { query: { name: file.name, use }, file: new Blob([file], { type: "application/octet-stream" }), key });

// Your freelance orders.

export const myGigOrders = (view: "current" | "past", cursor?: string) => list<GigOrder>("/v1/gigs/orders", { view, cursor });

/** While it waits for payment, each look also asks whether it was paid. File links last 10 minutes. */
export const getGigOrder = (id: string) => one<GigOrder>("GET", `/v1/gigs/orders/${enc(id)}`);

/** A fresh checkout link while it waits for payment. */
export const payGigOrder = (id: string, returnTo: string) => one<{ checkoutUrl: string }>("POST", `/v1/gigs/orders/${enc(id)}/pay`, { body: { returnTo } });

/** A full refund: before it's accepted, or once it's late. */
export const cancelGigOrder = (id: string, reason: string | undefined, key: string) =>
  one<GigOrder>("POST", `/v1/gigs/orders/${enc(id)}/cancel`, { body: reason ? { reason } : {}, key });

export const approveGigOrder = (id: string, note: string | undefined, key: string) =>
  one<GigOrder>("POST", `/v1/gigs/orders/${enc(id)}/approve`, { body: note ? { note } : {}, key });

export const askRevision = (id: string, note: string, key: string) => one<GigOrder>("POST", `/v1/gigs/orders/${enc(id)}/revision`, { body: { note }, key });

/** Opens a help ticket; Ruxstar decides the refund. */
export const reportGigProblem = (id: string, reason: string, key: string) => one<GigOrder>("POST", `/v1/gigs/orders/${enc(id)}/problem`, { body: { reason }, key });

// Your freelancer profile, portfolio and gigs.

/** NOT_FOUND until you start. */
export const myFreelancer = () => one<MyFreelancer>("GET", "/v1/gigs/me/");

/** Your profile, or null until you start freelancing. */
export async function myFreelancerOrNull(): Promise<MyFreelancer | null> {
  try {
    return await myFreelancer();
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.code === "NOT_FOUND")) return null;
    throw err;
  }
}

export const startFreelancing = (body: FreelancerInput, key: string) => one<MyFreelancer>("POST", "/v1/gigs/me/", { body, key });

export const updateFreelancer = (body: FreelancerPatch) => one<MyFreelancer>("PATCH", "/v1/gigs/me/", { body });

/** JPEG, PNG or WebP up to 8 MB. */
export const addPortfolioPhoto = (file: Blob) => one<MyFreelancer>("POST", "/v1/gigs/me/portfolio/photos", { file });

export const removePortfolioPhoto = (itemId: string) => one<MyFreelancer>("DELETE", `/v1/gigs/me/portfolio/photos/${enc(itemId)}`);

export const addPortfolioLink = (body: { title: string; url: string }) => one<MyFreelancer>("POST", "/v1/gigs/me/portfolio/links", { body });

export const removePortfolioLink = (itemId: string) => one<MyFreelancer>("DELETE", `/v1/gigs/me/portfolio/links/${enc(itemId)}`);

export const myGigs = (status?: GigStatus, cursor?: string) => list<MyGig>("/v1/gigs/me/gigs", { status, cursor });

/** Saved as a draft. */
export const createGig = (body: GigInput, key: string) => one<MyGig>("POST", "/v1/gigs/me/gigs", { body, key });

export const myGig = (id: string) => one<MyGig>("GET", `/v1/gigs/me/gigs/${enc(id)}`);

/** Packages and questions are replaced whole. Orders made keep what they bought. */
export const updateGig = (id: string, body: GigPatch) => one<MyGig>("PATCH", `/v1/gigs/me/gigs/${enc(id)}`, { body });

/** Only gigs never ordered. */
export const deleteGig = (id: string) => one<{ done: true }>("DELETE", `/v1/gigs/me/gigs/${enc(id)}`);

/** JPEG, PNG or WebP up to 8 MB. The first photo is the cover. */
export const addGigPhoto = (id: string, file: Blob) => one<MyGig>("POST", `/v1/gigs/me/gigs/${enc(id)}/photos`, { file });

export const removeGigPhoto = (id: string, photoId: string) => one<MyGig>("DELETE", `/v1/gigs/me/gigs/${enc(id)}/photos/${enc(photoId)}`);

/** Needs verification and everything in `missing`. */
export const publishGig = (id: string) => one<MyGig>("POST", `/v1/gigs/me/gigs/${enc(id)}/publish`);

export const pauseGig = (id: string) => one<MyGig>("POST", `/v1/gigs/me/gigs/${enc(id)}/pause`);

/** 1:1 chats only, from a verified freelancer. */
export const sendQuote = (chatId: string, body: QuoteInput, key: string) => one<Message>("POST", `/v1/social/chats/${enc(chatId)}/quotes`, { body, key });

// The freelancer's desk.

export const deskGigOrders = (status?: GigOrderStatus, cursor?: string) => list<GigOrder>("/v1/gigs/desk/orders", { status, cursor });

export const deskGigOrder = (id: string) => one<GigOrder>("GET", `/v1/gigs/desk/orders/${enc(id)}`);

export const acceptGigOrder = (id: string, key: string) => one<GigOrder>("POST", `/v1/gigs/desk/orders/${enc(id)}/accept`, { key });

/** Paid orders only; a full refund, and the customer is told why. */
export const declineGigOrder = (id: string, reason: string, key: string) => one<GigOrder>("POST", `/v1/gigs/desk/orders/${enc(id)}/decline`, { body: { reason }, key });

export const deliverGigOrder = (id: string, body: DeliverInput, key: string) => one<GigOrder>("POST", `/v1/gigs/desk/orders/${enc(id)}/deliver`, { body, key });

/** A full refund; the customer is told the reason. */
export const deskCancelGigOrder = (id: string, reason: string, key: string) => one<GigOrder>("POST", `/v1/gigs/desk/orders/${enc(id)}/cancel`, { body: { reason }, key });

export const withdrawQuote = (quoteId: string) => one<QuoteState>("POST", `/v1/gigs/desk/quotes/${enc(quoteId)}/withdraw`);

// The console.

export const consoleFreelancers = (q: string | undefined, cursor?: string) => list<ConsoleFreelancer>("/v1/ruxstar/gigs/freelancers", { q: trimmed(q), cursor });

export const consoleFreelancer = (businessId: string) => one<ConsoleFreelancer>("GET", `/v1/ruxstar/gigs/freelancers/${enc(businessId)}`);

/** The same hold as a business's: their gigs hide and nothing new can be sold. They're told the reason. */
export const suspendFreelancer = (businessId: string, reason: string, key: string) =>
  one<ConsoleFreelancer>("POST", `/v1/ruxstar/gigs/freelancers/${enc(businessId)}/suspend`, { body: { reason }, key });

export const restoreFreelancer = (businessId: string, key: string) => one<ConsoleFreelancer>("POST", `/v1/ruxstar/gigs/freelancers/${enc(businessId)}/restore`, { key });

export const consoleGigs = (query: ConsoleGigsQuery, cursor?: string) => list<ConsoleGig>("/v1/ruxstar/gigs/listings", { ...query, q: trimmed(query.q), cursor });

export const consoleGig = (id: string) => one<ConsoleGig>("GET", `/v1/ruxstar/gigs/listings/${enc(id)}`);

/** The freelancer is told the reason; placed orders go on. */
export const takeDownGig = (id: string, reason: string, key: string) => one<ConsoleGig>("POST", `/v1/ruxstar/gigs/listings/${enc(id)}/take-down`, { body: { reason }, key });

export const consoleGigOrders = (query: ConsoleGigOrdersQuery, cursor?: string) =>
  list<GigOrder>("/v1/ruxstar/gigs/orders", { ...query, q: trimmed(query.q), cursor });

export const consoleGigOrder = (id: string) => one<GigOrder>("GET", `/v1/ruxstar/gigs/orders/${enc(id)}`);

/** Both sides are told the note; it goes on the help ticket too. */
export const decideGigOrder = (id: string, body: DecideInput, key: string) => one<GigOrder>("POST", `/v1/ruxstar/gigs/orders/${enc(id)}/decide`, { body, key });
