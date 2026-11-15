import { signedIn } from "./account";
import { API_URL, ApiError, type ApiErrorBody } from "./client";
import type { Page } from "./social";
import type {
  Availability,
  AvailabilityQuery,
  Board,
  ConsoleFacility,
  ConsoleProperty,
  ConsolePropertyDetail,
  ConsoleReservation,
  DeskProperty,
  DeskReservation,
  DeskReservationsView,
  Facility,
  MyStaysView,
  ObjectionStatus,
  Offers,
  OffersInput,
  Placed,
  PropertyCard,
  PropertyDetail,
  PropertyFilters,
  PropertyInput,
  PropertyPatch,
  PropertyStatus,
  ReserveInput,
  RoomInput,
  RoomPatch,
  RoomPrices,
  RoomStatus,
  StayReservation,
  StaysRulesView,
  VendorProperty,
} from "./stays-types";

export type * from "./stays-types";

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

// Finding a place and reserving. These work signed out too, except reserving.

export const staysRules = () => one<StaysRulesView>("GET", "/v1/stays/rules");

export const listFacilities = async () => (await list<Facility>("/v1/stays/facilities")).items;

export const listProperties = (filters: PropertyFilters, cursor?: string) => list<PropertyCard>("/v1/stays/", { ...filters, cursor });

export const getProperty = (id: string) => one<PropertyDetail>("GET", `/v1/stays/${enc(id)}`);

/** For the server: a live property, cached for a minute. Null when it isn't there; the page then loads it in the browser. */
export async function fetchPublicProperty(id: string): Promise<PropertyDetail | null> {
  if (!/^[a-f0-9]{24}$/.test(id)) return null;
  try {
    const res = await fetch(`${API_URL}/v1/stays/${id}`, { headers: { "X-Client": "web" }, next: { revalidate: 60 } });
    if (!res.ok) return null;
    const property = ((await res.json()) as { data: PropertyDetail }).data;
    return property.status === "live" ? property : null;
  } catch {
    return null;
  }
}

/** Which beds are free for a stay starting `moveIn`, with the price of a bed or the whole room. */
export const availability = (propertyId: string, query: AvailabilityQuery) =>
  one<Availability>("GET", `/v1/stays/${enc(propertyId)}/availability`, { query: { ...query } });

export const stayOffers = (roomId: string, body: OffersInput) => one<Offers>("POST", `/v1/stays/rooms/${enc(roomId)}/offers`, { body });

/** Holds the bed for the checkout. Needs base KYC. Pass the same key when retrying the same click. */
export const reserveRoom = (roomId: string, body: ReserveInput, key: string) => one<Placed>("POST", `/v1/stays/rooms/${enc(roomId)}/reserve`, { body, key });

// Your stays.

export const myStays = (view: MyStaysView, cursor?: string) => list<StayReservation>("/v1/stays/orders", { view, cursor });

export const getStay = (id: string) => one<StayReservation>("GET", `/v1/stays/orders/${enc(id)}`);

/** A fresh checkout link while the bed is still held. */
export const payStay = (id: string, returnTo: string) => one<{ checkoutUrl: string }>("POST", `/v1/stays/orders/${enc(id)}/pay`, { body: { returnTo } });

export const cancelStay = (id: string, reason: string | undefined, key: string) =>
  one<StayReservation>("POST", `/v1/stays/orders/${enc(id)}/cancel`, { body: reason ? { reason } : {}, key });

/** Within the window after "Moved in". Ruxstar support reads the reason. */
export const objectStay = (id: string, reason: string, key: string) => one<StayReservation>("POST", `/v1/stays/orders/${enc(id)}/objection`, { body: { reason }, key });

export const withdrawObjection = (id: string) => one<StayReservation>("DELETE", `/v1/stays/orders/${enc(id)}/objection`);

/** Leave out `on` for the earliest day the notice period allows. */
export const giveNotice = (id: string, on: string | undefined, key: string) =>
  one<StayReservation>("POST", `/v1/stays/orders/${enc(id)}/notice`, { body: on ? { on } : {}, key });

// The owner's setup.

export const businessProperties = (businessId: string, cursor?: string) => list<VendorProperty>(`/v1/vendor/businesses/${enc(businessId)}/properties`, { cursor });

export const createProperty = (businessId: string, body: PropertyInput, key: string) =>
  one<VendorProperty>("POST", `/v1/vendor/businesses/${enc(businessId)}/properties`, { body, key });

export const vendorProperty = (id: string) => one<VendorProperty>("GET", `/v1/vendor/properties/${enc(id)}`);

export const updateProperty = (id: string, body: PropertyPatch) => one<VendorProperty>("PATCH", `/v1/vendor/properties/${enc(id)}`, { body });

/** Drafts only. */
export const deleteProperty = (id: string) => one<{ done: true }>("DELETE", `/v1/vendor/properties/${enc(id)}`);

/** JPEG, PNG or WebP up to 8 MB. The first photo is the cover. */
export const addPropertyPhoto = (id: string, file: Blob) => one<VendorProperty>("POST", `/v1/vendor/properties/${enc(id)}/photos`, { file });

export const removePropertyPhoto = (id: string, photoId: string) => one<VendorProperty>("DELETE", `/v1/vendor/properties/${enc(id)}/photos/${enc(photoId)}`);

export const publishProperty = (id: string, key: string) => one<VendorProperty>("POST", `/v1/vendor/properties/${enc(id)}/publish`, { key });

export const addRoom = (propertyId: string, body: RoomInput, key: string) => one<VendorProperty>("POST", `/v1/vendor/properties/${enc(propertyId)}/rooms`, { body, key });

export const updateRoom = (roomId: string, body: RoomPatch) => one<VendorProperty>("PATCH", `/v1/vendor/rooms/${enc(roomId)}`, { body });

/** Not while it has reservations not cancelled or ended. */
export const removeRoom = (roomId: string) => one<VendorProperty>("DELETE", `/v1/vendor/rooms/${enc(roomId)}`);

// The desk: the owner, and team members with stays permissions.

export const deskProperties = async () => (await list<DeskProperty>("/v1/stays/desk/properties")).items;

export const bedBoard = (propertyId: string, date: string) => one<Board>("GET", `/v1/stays/desk/properties/${enc(propertyId)}/board`, { query: { date } });

export const deskReservations = (propertyId: string, view: DeskReservationsView, cursor?: string) =>
  list<DeskReservation>(`/v1/stays/desk/properties/${enc(propertyId)}/reservations`, { view, cursor });

export const deskTenants = async (propertyId: string) => (await list<DeskReservation>(`/v1/stays/desk/properties/${enc(propertyId)}/tenants`)).items;

export const deskReservation = (id: string) => one<DeskReservation>("GET", `/v1/stays/desk/orders/${enc(id)}`);

export const markMovedIn = (id: string, key: string) => one<DeskReservation>("POST", `/v1/stays/desk/orders/${enc(id)}/moved-in`, { key });

/** Today when `on` is left out; a later day sets the move-out day. */
export const markMoveOut = (id: string, body: { on?: string; reason?: string }, key: string) =>
  one<DeskReservation>("POST", `/v1/stays/desk/orders/${enc(id)}/move-out`, { body, key });

/** The tenant gets everything back, platform fee included. */
export const deskCancel = (id: string, reason: string, key: string) => one<DeskReservation>("POST", `/v1/stays/desk/orders/${enc(id)}/cancel`, { body: { reason }, key });

export const setBedStatus = (bedId: string, status: "open" | "closed", key: string) =>
  one<{ id: string; label: string; status: "open" | "closed" }>("POST", `/v1/stays/desk/beds/${enc(bedId)}/status`, { body: { status }, key });

export const setRoomStatus = (roomId: string, status: RoomStatus, key: string) =>
  one<VendorProperty>("POST", `/v1/stays/desk/rooms/${enc(roomId)}/status`, { body: { status }, key });

/** "Edit the listing and prices": the owner or a team member allowed to. */
export const deskUpdateProperty = (id: string, body: PropertyPatch) => one<VendorProperty>("PATCH", `/v1/stays/desk/properties/${enc(id)}`, { body });

export const setRoomPrices = (roomId: string, prices: RoomPrices) => one<VendorProperty>("PUT", `/v1/stays/desk/rooms/${enc(roomId)}/prices`, { body: { prices } });

// The console.

export const consoleProperties = (filters: { status?: PropertyStatus; q?: string; city?: string }, cursor?: string) =>
  list<ConsoleProperty>("/v1/ruxstar/stays/properties", { ...filters, cursor });

export const consoleProperty = (id: string) => one<ConsolePropertyDetail>("GET", `/v1/ruxstar/stays/properties/${enc(id)}`);

/** Refunds every reservation not moved in yet in full; the owner and the tenants are told the reason. */
export const takeDownProperty = (id: string, reason: string, key: string) =>
  one<{ property: VendorProperty; refunded: number }>("POST", `/v1/ruxstar/stays/properties/${enc(id)}/take-down`, { body: { reason }, key });

export const consoleFacilities = async () => (await list<ConsoleFacility>("/v1/ruxstar/stays/facilities")).items;

export const createFacility = (body: { key: string; name: string; order?: number }, key: string) =>
  one<ConsoleFacility>("POST", "/v1/ruxstar/stays/facilities", { body, key });

export const updateFacility = (facilityKey: string, body: { name?: string; active?: boolean; order?: number }) =>
  one<ConsoleFacility>("PATCH", `/v1/ruxstar/stays/facilities/${enc(facilityKey)}`, { body });

export const consoleObjections = (status: ObjectionStatus, cursor?: string) => list<ConsoleReservation>("/v1/ruxstar/stays/objections", { status, cursor });

/** release: pay the owner. refund: everything back to the tenant and the stay ends. Both sides read the note. */
export const decideObjection = (id: string, body: { decision: "release" | "refund"; note: string }, key: string) =>
  one<ConsoleReservation>("POST", `/v1/ruxstar/stays/reservations/${enc(id)}/objection`, { body, key });
