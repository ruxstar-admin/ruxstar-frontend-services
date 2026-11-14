import { signedIn } from "./account";
import { api, API_URL, ApiError, unwrap, type ApiErrorBody } from "./client";
import type { paths } from "./schema";
import type { Page } from "./social";

type Data<T> = T extends { content: { "application/json": { data: infer D } } } ? D : never;
type Body<T> = T extends { requestBody: { content: { "application/json": infer B } } } ? B : never;
type Query<T> = T extends { parameters: { query?: infer Q } } ? NonNullable<Q> : never;

export type EventCard = Data<paths["/v1/events/"]["get"]["responses"][200]>[number];
export type EventKind = EventCard["kind"];
export type EventFilters = Pick<Query<paths["/v1/events/"]["get"]>, "q" | "kind" | "city">;
export type EventDetail = Data<paths["/v1/events/{id}"]["get"]["responses"][200]>;
export type EventTier = EventDetail["tiers"][number];
export type EventQuestion = EventDetail["questions"][number];
export type MyWait = EventDetail["myWaits"][number];
export type EventRules = Data<paths["/v1/events/rules"]["get"]["responses"][200]>;
export type BookBody = Body<paths["/v1/events/{id}/tickets"]["post"]>;
export type HolderInput = BookBody["tickets"][number];
export type Placed = Data<paths["/v1/events/{id}/tickets"]["post"]["responses"][201]>;
export type TicketOrder = Data<paths["/v1/events/orders/{id}"]["get"]["responses"][200]>;
export type TicketOrderStatus = TicketOrder["status"];
export type TicketView = TicketOrder["tickets"][number];
export type TicketStatus = TicketView["status"];
export type MyTicketsView = NonNullable<Query<paths["/v1/events/orders"]["get"]>["view"]>;

export type VendorEvent = Data<paths["/v1/vendor/events/{id}"]["get"]["responses"][200]>;
export type VendorEventStatus = VendorEvent["status"];
export type EventInput = Body<paths["/v1/vendor/businesses/{id}/events"]["post"]>;
export type EventPatch = Body<paths["/v1/vendor/events/{id}"]["patch"]>;
export type RefundPolicy = EventInput["refunds"];
export type Booking = Data<paths["/v1/vendor/events/{id}/bookings"]["get"]["responses"][200]>[number];
export type BookingStatus = NonNullable<Query<paths["/v1/vendor/events/{id}/bookings"]["get"]>["status"]>;

export type DeskEvent = Data<paths["/v1/events/desk/{id}"]["get"]["responses"][200]>;
export type DeskCounts = DeskEvent["counts"];
export type ScanResult = Data<paths["/v1/events/desk/{id}/scan"]["post"]["responses"][200]>;
export type ScanOutcome = ScanResult["result"];
export type LookupTicket = Data<paths["/v1/events/desk/{id}/lookup"]["get"]["responses"][200]>[number];
export type Guest = Data<paths["/v1/events/desk/{id}/guests"]["get"]["responses"][200]>[number];
export type GuestsView = NonNullable<Query<paths["/v1/events/desk/{id}/guests"]["get"]>["view"]>;

export type StaffEventStatus = NonNullable<Query<paths["/v1/ruxstar/events"]["get"]>["status"]>;

const byId = (id: string) => ({ params: { path: { id } } });
const keyed = (key: string) => ({ headers: { "Idempotency-Key": key } });
const toPage = <T>(envelope: { data: T[]; meta: { nextCursor?: string | null } }): Page<T> => ({
  items: envelope.data,
  nextCursor: envelope.meta.nextCursor ?? null,
});

// What's on, booking and the waitlist.

export const eventRules = async () => (await signedIn(() => unwrap(api.GET("/v1/events/rules")))).data;

export const listEvents = async (filters: EventFilters, cursor?: string) =>
  toPage(await signedIn(() => unwrap(api.GET("/v1/events/", { params: { query: { ...filters, cursor } } }))));

/** With the signed-in person's own bookings and waitlist places, and seats left right now. */
export const getEvent = async (id: string) => (await signedIn(() => unwrap(api.GET("/v1/events/{id}", byId(id))))).data;

export type PublicEvent = Omit<EventDetail, "myOrders" | "myWaits">;

/**
 * For the server: the event without anyone's bookings, cached for a minute. Null when it isn't there or the API
 * only answers people who are signed in; the page then loads it in the browser instead.
 */
export async function fetchPublicEvent(id: string): Promise<PublicEvent | null> {
  if (!/^[a-f0-9]{24}$/.test(id)) return null;
  try {
    const res = await fetch(`${API_URL}/v1/events/${id}`, { headers: { "X-Client": "web" }, next: { revalidate: 60 } });
    if (!res.ok) return null;
    const { myOrders: _orders, myWaits: _waits, ...event } = ((await res.json()) as { data: EventDetail }).data;
    return event;
  } catch {
    return null;
  }
}

/** Free tickets come back confirmed with no checkout link. Pass the same key when retrying the same click. */
export const bookTickets = async (eventId: string, body: BookBody, key: string) =>
  (await signedIn(() => unwrap(api.POST("/v1/events/{id}/tickets", { ...byId(eventId), body, ...keyed(key) })))).data;

export const joinWaitlist = async (eventId: string, tierId: string, quantity: number, key: string) =>
  (await signedIn(() => unwrap(api.POST("/v1/events/{id}/waitlist", { ...byId(eventId), body: { tierId, quantity }, ...keyed(key) })))).data;

export const leaveWaitlist = async (waitId: string) => {
  await signedIn(() => unwrap(api.DELETE("/v1/events/waitlist/{id}", byId(waitId))));
};

export const myTickets = async (view: MyTicketsView, cursor?: string) =>
  toPage(await signedIn(() => unwrap(api.GET("/v1/events/orders", { params: { query: { view, cursor } } }))));

/** While it waits for payment, the API asks Cashfree whether it was paid. */
export const getTicketOrder = async (id: string) => (await signedIn(() => unwrap(api.GET("/v1/events/orders/{id}", byId(id))))).data;

export const payTickets = async (id: string, returnTo: string) =>
  (await signedIn(() => unwrap(api.POST("/v1/events/orders/{id}/pay", { ...byId(id), body: { returnTo } })))).data;

export const cancelTickets = async (id: string, key: string) =>
  (await signedIn(() => unwrap(api.POST("/v1/events/orders/{id}/cancel", { ...byId(id), ...keyed(key) })))).data;

// Organising.

export const businessEvents = async (businessId: string) =>
  toPage(await signedIn(() => unwrap(api.GET("/v1/vendor/businesses/{id}/events", byId(businessId)))));

export const createEvent = async (businessId: string, body: EventInput, key: string) =>
  (await signedIn(() => unwrap(api.POST("/v1/vendor/businesses/{id}/events", { ...byId(businessId), body, ...keyed(key) })))).data;

export const getVendorEvent = async (id: string) => (await signedIn(() => unwrap(api.GET("/v1/vendor/events/{id}", byId(id))))).data;

export const updateEvent = async (id: string, body: EventPatch) =>
  (await signedIn(() => unwrap(api.PATCH("/v1/vendor/events/{id}", { ...byId(id), body })))).data;

/** The spec has no body for this route (it is the raw image), so it skips the typed client. */
async function postPoster(id: string, photo: Blob): Promise<VendorEvent> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/v1/vendor/events/${encodeURIComponent(id)}/photo`, {
      method: "POST",
      credentials: "include",
      headers: { "X-Client": "web", "Content-Type": photo.type },
      body: photo,
    });
  } catch {
    throw new ApiError(0, "NETWORK", "The upload stopped. Check your connection and try again.");
  }
  const body = (await response.json().catch(() => null)) as { data?: VendorEvent; error?: ApiErrorBody } | null;
  if (response.ok && body?.data) return body.data;
  if (body?.error) throw new ApiError(response.status, body.error.code, body.error.message, body.error.details);
  throw new ApiError(response.status, "INTERNAL", "Something went wrong on our side.");
}

export const setPoster = (id: string, photo: Blob) => signedIn(() => postPoster(id, photo));

export const publishEvent = async (id: string, key: string) =>
  (await signedIn(() => unwrap(api.POST("/v1/vendor/events/{id}/publish", { ...byId(id), ...keyed(key) })))).data;

export const cancelEvent = async (id: string, reason: string, key: string) =>
  (await signedIn(() => unwrap(api.POST("/v1/vendor/events/{id}/cancel", { ...byId(id), body: { reason }, ...keyed(key) })))).data;

/** Drafts only. */
export const deleteEvent = async (id: string) => {
  await signedIn(() => unwrap(api.DELETE("/v1/vendor/events/{id}", byId(id))));
};

export const eventBookings = async (id: string, status: BookingStatus, cursor?: string) =>
  toPage(await signedIn(() => unwrap(api.GET("/v1/vendor/events/{id}/bookings", { params: { path: { id }, query: { status, cursor } } }))));

// The gate, for the owner and the team.

export const deskEvents = async () => toPage(await signedIn(() => unwrap(api.GET("/v1/events/desk/"))));

/** Two counts on indexes: cheap enough to poll every 10 seconds. */
export const getDeskEvent = async (id: string) => (await signedIn(() => unwrap(api.GET("/v1/events/desk/{id}", byId(id))))).data;

export const scanTicket = async (id: string, qr: string) =>
  (await signedIn(() => unwrap(api.POST("/v1/events/desk/{id}/scan", { ...byId(id), body: { qr } })))).data;

/** Six letters, or a 10-digit mobile. */
export const lookupTickets = async (id: string, q: string) =>
  (await signedIn(() => unwrap(api.GET("/v1/events/desk/{id}/lookup", { params: { path: { id }, query: { q } } })))).data;

export const checkInTicket = async (id: string, ticketId: string) =>
  (await signedIn(() => unwrap(api.POST("/v1/events/desk/{id}/tickets/{ticketId}/check-in", { params: { path: { id, ticketId } } })))).data;

export const guestList = async (id: string, view: GuestsView, cursor?: string) =>
  toPage(await signedIn(() => unwrap(api.GET("/v1/events/desk/{id}/guests", { params: { path: { id }, query: { view, cursor } } }))));

// The console.

export const staffEvents = async (filter: { status?: StaffEventStatus; q?: string }, cursor?: string) =>
  toPage(await signedIn(() => unwrap(api.GET("/v1/ruxstar/events", { params: { query: { ...filter, cursor } } }))));

export const getStaffEvent = async (id: string) => (await signedIn(() => unwrap(api.GET("/v1/ruxstar/events/{id}", byId(id))))).data;

/** Cancels it and refunds everyone; the organiser and every ticket holder see the reason. */
export const takeDownEvent = async (id: string, reason: string, key: string) =>
  (await signedIn(() => unwrap(api.POST("/v1/ruxstar/events/{id}/take-down", { ...byId(id), body: { reason }, ...keyed(key) })))).data;
