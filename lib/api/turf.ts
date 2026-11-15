import { signedIn } from "./account";
import { API_URL, ApiError, type ApiErrorBody } from "./client";
import type { Page } from "./social";
import type {
  Board,
  BookInput,
  ConsoleGround,
  ConsoleGroundDetail,
  ConsoleSport,
  CourtInput,
  CourtPatch,
  DaySlots,
  DeskBooking,
  DeskBookingsView,
  DeskGround,
  GroundCard,
  GroundDetail,
  GroundFilters,
  GroundInput,
  GroundPatch,
  GroundStatus,
  MyBookingsView,
  Offers,
  OffersInput,
  Placed,
  PricesInput,
  Sport,
  TurfBooking,
  TurfRules,
  TurfRulesView,
  VendorGround,
} from "./turf-types";

export type * from "./turf-types";

type Query = Record<string, string | number | boolean | undefined>;
interface Call {
  query?: Query;
  body?: unknown;
  /** The raw file, sent as its own content type. */
  file?: Blob;
  key?: string;
}

/** A small typed fetch with the same headers, cookies and errors as `api`, which also sends raw photos. */
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

// Finding grounds and booking. These work signed out too.

export const turfRules = () => one<TurfRulesView>("GET", "/v1/turf/rules");

export const listSports = async () => (await list<Sport>("/v1/turf/sports")).items;

export const listGrounds = (filters: GroundFilters, cursor?: string) => list<GroundCard>("/v1/turf/", { ...filters, cursor });

export const getGround = (id: string) => one<GroundDetail>("GET", `/v1/turf/${enc(id)}`);

/** For the server: a live ground, cached for a minute. Null when it isn't there; the page then loads it in the browser. */
export async function fetchPublicGround(id: string): Promise<GroundDetail | null> {
  if (!/^[a-f0-9]{24}$/.test(id)) return null;
  try {
    const res = await fetch(`${API_URL}/v1/turf/${id}`, { headers: { "X-Client": "web" }, next: { revalidate: 60 } });
    if (!res.ok) return null;
    const ground = ((await res.json()) as { data: GroundDetail }).data;
    return ground.status === "live" ? ground : null;
  } catch {
    return null;
  }
}

/** A court's slots on a day, from now on when it's today. */
export const courtSlots = (courtId: string, date: string) => one<DaySlots>("GET", `/v1/turf/courts/${enc(courtId)}/slots`, { query: { date } });

export const bookingOffers = (courtId: string, body: OffersInput) => one<Offers>("POST", `/v1/turf/courts/${enc(courtId)}/offers`, { body });

/** Holds the slots for the checkout. Pass the same key when retrying the same click. */
export const bookCourt = (courtId: string, body: BookInput, key: string) => one<Placed>("POST", `/v1/turf/courts/${enc(courtId)}/book`, { body, key });

// Your bookings.

export const myBookings = (view: MyBookingsView, cursor?: string) => list<TurfBooking>("/v1/turf/orders", { view, cursor });

export const getBooking = (id: string) => one<TurfBooking>("GET", `/v1/turf/orders/${enc(id)}`);

/** A fresh checkout link while the slots are still held. */
export const payBooking = (id: string, returnTo: string) => one<{ checkoutUrl: string }>("POST", `/v1/turf/orders/${enc(id)}/pay`, { body: { returnTo } });

/** Leave out `occurrences` for every date still to come. */
export const cancelBooking = (id: string, body: { occurrences?: number[]; reason?: string }, key: string) =>
  one<TurfBooking>("POST", `/v1/turf/orders/${enc(id)}/cancel`, { body, key });

// The owner's setup.

export const businessGrounds = (businessId: string, cursor?: string) => list<VendorGround>(`/v1/vendor/businesses/${enc(businessId)}/grounds`, { cursor });

export const createGround = (businessId: string, body: GroundInput, key: string) =>
  one<VendorGround>("POST", `/v1/vendor/businesses/${enc(businessId)}/grounds`, { body, key });

export const vendorGround = (id: string) => one<VendorGround>("GET", `/v1/vendor/grounds/${enc(id)}`);

export const updateGround = (id: string, body: GroundPatch) => one<VendorGround>("PATCH", `/v1/vendor/grounds/${enc(id)}`, { body });

/** Drafts only. */
export const deleteGround = (id: string) => one<{ done: true }>("DELETE", `/v1/vendor/grounds/${enc(id)}`);

/** JPEG, PNG or WebP up to 8 MB. The first photo is the cover. */
export const addGroundPhoto = (id: string, file: Blob) => one<VendorGround>("POST", `/v1/vendor/grounds/${enc(id)}/photos`, { file });

export const removeGroundPhoto = (id: string, photoId: string) => one<VendorGround>("DELETE", `/v1/vendor/grounds/${enc(id)}/photos/${enc(photoId)}`);

export const publishGround = (id: string, key: string) => one<VendorGround>("POST", `/v1/vendor/grounds/${enc(id)}/publish`, { key });

export const addCourt = (groundId: string, body: CourtInput, key: string) => one<VendorGround>("POST", `/v1/vendor/grounds/${enc(groundId)}/courts`, { body, key });

export const updateCourt = (courtId: string, body: CourtPatch) => one<VendorGround>("PATCH", `/v1/vendor/courts/${enc(courtId)}`, { body });

/** Only without bookings still to come. */
export const removeCourt = (courtId: string) => one<VendorGround>("DELETE", `/v1/vendor/courts/${enc(courtId)}`);

// The desk: the owner, and team members with turf permissions.

export const deskGrounds = async () => (await list<DeskGround>("/v1/turf/desk/grounds")).items;

export const groundBoard = (groundId: string, date: string) => one<Board>("GET", `/v1/turf/desk/grounds/${enc(groundId)}/board`, { query: { date } });

export const blockSlots = (body: { courtId: string; startAts: string[]; note?: string }, key: string) =>
  one<{ done: number }>("POST", "/v1/turf/desk/slots/block", { body, key });

export const unblockSlots = (body: { courtId: string; startAts: string[] }, key: string) => one<{ done: number }>("POST", "/v1/turf/desk/slots/unblock", { body, key });

/** "Change prices and add-ons": the owner or a team member allowed to. */
export const setCourtPrices = (courtId: string, body: PricesInput) => one<VendorGround>("PUT", `/v1/turf/desk/courts/${enc(courtId)}/prices`, { body });

export const deskBookings = (groundId: string, view: DeskBookingsView, cursor?: string) =>
  list<DeskBooking>(`/v1/turf/desk/grounds/${enc(groundId)}/bookings`, { view, cursor });

export const deskBooking = (id: string) => one<DeskBooking>("GET", `/v1/turf/desk/orders/${enc(id)}`);

/** The customer gets everything back, platform fee included. */
export const deskCancel = (id: string, body: { occurrences?: number[]; reason: string }, key: string) =>
  one<DeskBooking>("POST", `/v1/turf/desk/orders/${enc(id)}/cancel`, { body, key });

export const markArrival = (id: string, body: { n: number; status: "arrived" | "no_show" }, key: string) =>
  one<DeskBooking>("POST", `/v1/turf/desk/orders/${enc(id)}/arrival`, { body, key });

// The console.

export const consoleGrounds = (filters: { status?: GroundStatus; q?: string }, cursor?: string) => list<ConsoleGround>("/v1/ruxstar/turf/grounds", { ...filters, cursor });

export const consoleGround = (id: string) => one<ConsoleGroundDetail>("GET", `/v1/ruxstar/turf/grounds/${enc(id)}`);

/** Refunds every booking still to come in full; the owner and the customers are told the reason. */
export const takeDownGround = (id: string, reason: string, key: string) =>
  one<{ ground: VendorGround; refunded: number }>("POST", `/v1/ruxstar/turf/grounds/${enc(id)}/take-down`, { body: { reason }, key });

export const consoleSports = async () => (await list<ConsoleSport>("/v1/ruxstar/turf/sports")).items;

export const createSport = (body: { key: string; name: string; order?: number }, key: string) => one<ConsoleSport>("POST", "/v1/ruxstar/turf/sports", { body, key });

export const updateSport = (sportKey: string, body: { name?: string; active?: boolean; order?: number }) =>
  one<ConsoleSport>("PATCH", `/v1/ruxstar/turf/sports/${enc(sportKey)}`, { body });

/** Only what changed. The module's settings come back with `turfRules`. */
export const updateTurfRules = <T>(changes: Partial<TurfRules>) => one<T>("PATCH", "/v1/ruxstar/modules/turf", { body: { turfRules: changes } });
