import { signedIn } from "./account";
import { api, API_URL, ApiError, newIdempotencyKey, unwrap, type ApiErrorBody } from "./client";
import type { paths } from "./schema";
import { money } from "./shops";
import type { Page } from "./social";

type Data<T> = T extends { content: { "application/json": { data: infer D } } } ? D : never;
type Body<T> = T extends { requestBody: { content: { "application/json": infer B } } } ? B : never;
type BusinessPath = paths["/v1/vendor/businesses/{id}"];

export type Business = Data<BusinessPath["get"]["responses"][200]>;
export type BusinessCatalog = Data<paths["/v1/vendor/catalog"]["get"]["responses"][200]>;
export type BusinessCategory = BusinessCatalog["categories"][number];
export type BusinessTypeInfo = BusinessCategory["types"][number];
export type BusinessModule = Business["module"];
export type BusinessMissing = Business["missing"][number];
export type BusinessLocation = NonNullable<Business["location"]>;
export type PodSetup = NonNullable<Business["pod"]>;
export type PodPrice = PodSetup["prices"][number];
export type PodProduct = PodSetup["products"][number];
export type PodProductInfo = BusinessCatalog["podProducts"][number];
export type NewBusiness = Body<paths["/v1/vendor/businesses"]["post"]>;
export type BusinessUpdate = Body<BusinessPath["patch"]>;
export type LocationInput = NewBusiness["location"];
export type PodSetupUpdate = Body<paths["/v1/vendor/businesses/{id}/pod"]["patch"]>;
export type Payments = Data<paths["/v1/vendor/payments"]["get"]["responses"][200]>;
export type PayoutMethod = NonNullable<Payments["payoutMethod"]>;
export type PayoutMethodInput = Body<paths["/v1/vendor/payout-method"]["put"]>;
/**
 * `paid` is a share arriving as pending, `available` its hold ending (the same money moving), `refund` money going back,
 * `withdrawal` money withdrawn and `returned` a failed withdrawal coming back.
 */
export type StatementLine = Data<paths["/v1/vendor/payments/statement"]["get"]["responses"][200]>[number];

const byId = (id: string) => ({ params: { path: { id } } });

/** Categories with their types and module state, states and cities, and print products. */
export const businessCatalog = async () => (await signedIn(() => unwrap(api.GET("/v1/vendor/catalog")))).data;

let catalogOnce: Promise<BusinessCatalog> | null = null;

/** Fetched once per visit. `fresh` asks again, for Add a business, where module state matters. */
export function vendorCatalog(fresh = false) {
  if (fresh) catalogOnce = null;
  catalogOnce ??= businessCatalog().catch((err: unknown) => {
    catalogOnce = null;
    throw err;
  });
  return catalogOnce;
}

export const myBusinesses = async () => (await signedIn(() => unwrap(api.GET("/v1/vendor/businesses")))).data;

export const getBusiness = async (id: string) => (await signedIn(() => unwrap(api.GET("/v1/vendor/businesses/{id}", byId(id))))).data;

/** Starts a draft. Pass the same key when retrying the same click. */
export const createBusiness = async (body: NewBusiness, idempotencyKey: string) =>
  (await signedIn(() => unwrap(api.POST("/v1/vendor/businesses", { body, headers: { "Idempotency-Key": idempotencyKey } })))).data;

export const updateBusiness = async (id: string, body: BusinessUpdate) =>
  (await signedIn(() => unwrap(api.PATCH("/v1/vendor/businesses/{id}", { ...byId(id), body })))).data;

/** Print on demand: products, area and prices. `prices` replaces the prices of the products it names. */
export const updatePod = async (id: string, body: PodSetupUpdate) =>
  (await signedIn(() => unwrap(api.PATCH("/v1/vendor/businesses/{id}/pod", { ...byId(id), body })))).data;

/** The spec has no body for these routes (it is the raw image), so they skip the typed client. */
async function postPhoto(path: string, photo: Blob): Promise<Business> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "X-Client": "web", "Content-Type": photo.type },
      body: photo,
    });
  } catch {
    throw new ApiError(0, "NETWORK", "The upload stopped. Check your connection and try again.");
  }
  const body = (await response.json().catch(() => null)) as { data?: Business; error?: ApiErrorBody } | null;
  if (response.ok && body?.data) return body.data;
  if (body?.error) throw new ApiError(response.status, body.error.code, body.error.message, body.error.details);
  throw new ApiError(response.status, "INTERNAL", "Something went wrong on our side.");
}

/** A JPEG; the API keeps up to 3, the first being the cover. */
export const addBusinessPhoto = (id: string, photo: Blob) => signedIn(() => postPhoto(`/v1/vendor/businesses/${encodeURIComponent(id)}/photos`, photo));

export const removeBusinessPhoto = async (id: string, photoId: string) =>
  (await signedIn(() => unwrap(api.DELETE("/v1/vendor/businesses/{id}/photos/{photoId}", { params: { path: { id, photoId } } })))).data;

export const publishBusiness = async (id: string) =>
  (await signedIn(() => unwrap(api.POST("/v1/vendor/businesses/{id}/publish", { ...byId(id), headers: { "Idempotency-Key": newIdempotencyKey() } })))).data;

export const setBusinessOpen = async (id: string, open: boolean) =>
  (await signedIn(() => unwrap(open ? api.POST("/v1/vendor/businesses/{id}/open", byId(id)) : api.POST("/v1/vendor/businesses/{id}/close", byId(id))))).data;

/** Drafts only. */
export const deleteBusiness = (id: string) => signedIn(() => unwrap(api.DELETE("/v1/vendor/businesses/{id}", byId(id))));

// The shop someone works at, by their place id in Work. Each call needs its permission; the GSTIN stays with the owner.

export type TeamBusinessUpdate = Body<paths["/v1/employment/{id}/shop"]["patch"]>;

export const getTeamShop = async (placeId: string) => (await signedIn(() => unwrap(api.GET("/v1/employment/{id}/shop", byId(placeId))))).data;

export const updateTeamShop = async (placeId: string, body: TeamBusinessUpdate) =>
  (await signedIn(() => unwrap(api.PATCH("/v1/employment/{id}/shop", { ...byId(placeId), body })))).data;

export const updateTeamPod = async (placeId: string, body: PodSetupUpdate) =>
  (await signedIn(() => unwrap(api.PATCH("/v1/employment/{id}/shop/pod", { ...byId(placeId), body })))).data;

export const addTeamShopPhoto = (placeId: string, photo: Blob) =>
  signedIn(() => postPhoto(`/v1/employment/${encodeURIComponent(placeId)}/shop/photos`, photo));

export const removeTeamShopPhoto = async (placeId: string, photoId: string) =>
  (await signedIn(() => unwrap(api.DELETE("/v1/employment/{id}/shop/photos/{photoId}", { params: { path: { id: placeId, photoId } } })))).data;

export const setTeamShopOpen = async (placeId: string, open: boolean) =>
  (await signedIn(() => unwrap(open ? api.POST("/v1/employment/{id}/shop/open", byId(placeId)) : api.POST("/v1/employment/{id}/shop/close", byId(placeId))))).data;

/**
 * The shop pages for the owner, by business id in the vendor portal, or for someone on the team, by their place id in Work.
 * The calls are the same; only the pages differ. The team never sends a GSTIN.
 */
export function shopDesk(team: boolean) {
  return team
    ? {
        team,
        home: (id: string) => `/work/${id}/shop`,
        get: getTeamShop,
        update: (id: string, body: BusinessUpdate) => updateTeamShop(id, body),
        updatePod: updateTeamPod,
        addPhoto: addTeamShopPhoto,
        removePhoto: removeTeamShopPhoto,
        setOpen: setTeamShopOpen,
      }
    : {
        team,
        home: (id: string) => `/vendor/businesses/${id}`,
        get: getBusiness,
        update: updateBusiness,
        updatePod,
        addPhoto: addBusinessPhoto,
        removePhoto: removeBusinessPhoto,
        setOpen: setBusinessOpen,
      };
}

export const vendorPayments = async () => (await signedIn(() => unwrap(api.GET("/v1/vendor/payments")))).data;

/** Every change to the vendor's earnings, newest first. */
export const vendorStatement = async (cursor?: string): Promise<Page<StatementLine>> => {
  const envelope = await signedIn(() => unwrap(api.GET("/v1/vendor/payments/statement", { params: { query: { cursor } } })));
  return { items: envelope.data, nextCursor: envelope.meta.nextCursor ?? null };
};

/** Everything available, less the fee, to the checked bank account or UPI ID. Pass the same key when retrying the same click. */
export const withdraw = async (idempotencyKey: string) =>
  (await signedIn(() => unwrap(api.POST("/v1/vendor/payouts", { headers: { "Idempotency-Key": idempotencyKey } })))).data;

/** Checked with Cashfree; it must be in the name on the vendor's Aadhaar. */
export const setPayoutMethod = async (body: PayoutMethodInput) =>
  (await signedIn(() => unwrap(api.PUT("/v1/vendor/payout-method", { body })))).data;

export type VendorCoupon = Data<paths["/v1/vendor/coupons"]["get"]["responses"][200]>[number];
export type NewVendorCoupon = Body<paths["/v1/vendor/coupons"]["post"]>;
export type VendorCouponPatch = Body<paths["/v1/vendor/coupons/{id}"]["patch"]>;

/** The vendor's coupons for their print shops, newest first. */
export const vendorCoupons = async (cursor?: string): Promise<Page<VendorCoupon>> => {
  const envelope = await signedIn(() => unwrap(api.GET("/v1/vendor/coupons", { params: { query: { cursor } } })));
  return { items: envelope.data, nextCursor: envelope.meta.nextCursor ?? null };
};

/** Pass the same key when retrying the same click. */
export const createVendorCoupon = async (body: NewVendorCoupon, idempotencyKey: string) =>
  (await signedIn(() => unwrap(api.POST("/v1/vendor/coupons", { body, headers: { "Idempotency-Key": idempotencyKey } })))).data;

export const updateVendorCoupon = async (id: string, body: VendorCouponPatch) =>
  (await signedIn(() => unwrap(api.PATCH("/v1/vendor/coupons/{id}", { ...byId(id), body })))).data;

export type NewTeamCoupon = Body<paths["/v1/employment/{id}/coupons"]["post"]>;
export type TeamCouponPatch = Body<paths["/v1/employment/{id}/coupons/{couponId}"]["patch"]>;

/** One shop's coupons for someone on its team, with the owner's ones for several shops too (only the owner changes those). */
export const teamCoupons = async (placeId: string, cursor?: string): Promise<Page<VendorCoupon>> => {
  const envelope = await signedIn(() => unwrap(api.GET("/v1/employment/{id}/coupons", { params: { path: { id: placeId }, query: { cursor } } })));
  return { items: envelope.data, nextCursor: envelope.meta.nextCursor ?? null };
};

/** It works at this shop only. Pass the same key when retrying the same click. */
export const createTeamCoupon = async (placeId: string, body: NewTeamCoupon, idempotencyKey: string) =>
  (await signedIn(() => unwrap(api.POST("/v1/employment/{id}/coupons", { ...byId(placeId), body, headers: { "Idempotency-Key": idempotencyKey } })))).data;

export const updateTeamCoupon = async (placeId: string, couponId: string, body: TeamCouponPatch) =>
  (await signedIn(() => unwrap(api.PATCH("/v1/employment/{id}/coupons/{couponId}", { params: { path: { id: placeId, couponId } }, body })))).data;

// Words and lines, the same as the app.

export const MODULE_ICON = { pod: "print", events: "ticket", coaching: "book", stays: "home" } as const satisfies Record<BusinessModule, string>;
export const TYPE_ICON = {
  print_shop: "print",
  concert: "ticket",
  sports_event: "star",
  coaching: "book",
  pg: "home",
  hostel: "home",
} as const satisfies Record<Business["type"], string>;

export const MISSING_LABEL: Record<BusinessMissing, string> = {
  photo: "a cover photo",
  phone: "a phone number",
  location: "a location",
  products: "the products you print",
  area: "where you deliver",
  pricing: "prices for every product",
  gstin: "a GSTIN, in the business details",
};

/** Only a live business that is not on hold, in a module Ruxstar has not paused, can open and close. */
export const canOpen = (b: Business) => b.status === "live" && !b.suspension && b.moduleLive;

/** The one tag a business shows: on hold beats everything, then draft, then paused, open or closed. */
export function statusOf(b: Business): { label: string; tone: "neutral" | "success" | "warning" | "danger" } {
  if (b.suspension) return { label: "On hold", tone: "danger" };
  if (b.status === "draft") return { label: "Draft", tone: "neutral" };
  if (!b.moduleLive) return { label: "Paused", tone: "warning" };
  return b.open ? { label: "Open", tone: "success" } : { label: "Closed", tone: "neutral" };
}

/** "a, b and c" */
export const listOf = (items: string[]) => (items.length < 2 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`);

export const titleCase = (text: string) => text.replace(/\b\p{L}/gu, (c) => c.toUpperCase());

/** 12550 paise → "125.50"; whole rupees drop the decimals. */
export const rupeesText = (paise: number | null | undefined) => {
  if (paise == null) return "";
  return paise % 100 === 0 ? String(paise / 100) : (paise / 100).toFixed(2);
};

/** What a vendor types in a rupee field: digits and up to two decimals. */
export const rupeeInput = (text: string) => {
  const cleaned = text.replace(/[^0-9.]/g, "");
  const [whole, ...rest] = cleaned.split(".");
  return rest.length ? `${whole!.slice(0, 6)}.${rest.join("").slice(0, 2)}` : whole!.slice(0, 6);
};

/** "125.5" → 12550; empty → null. */
export const paiseOf = (text: string): number | null => {
  if (!text.trim()) return null;
  const value = Number(text);
  return Number.isFinite(value) ? Math.round(value * 100) : null;
};

export const digitsOnly = (text: string, max: number) => text.replace(/\D/g, "").slice(0, max);

/** "B/W ₹2 · Colour ₹10 a page" or "₹250 a unit · min 10". */
export function priceLine(price: PodPrice | undefined): string | null {
  if (!price) return null;
  if (price.model === "per_page") {
    const parts = [price.bw ? `B/W ${money(price.bw)}` : null, price.color ? `Colour ${money(price.color)}` : null].filter(Boolean);
    return parts.length ? `${parts.join(" · ")} a page` : null;
  }
  return price.basePrice ? `${money(price.basePrice)} a unit · min ${price.minQuantity}` : null;
}

export function areaLine(pod: PodSetup): string {
  if (pod.serveAll) return "Every city";
  if (!pod.cities.length) return "Not set";
  return pod.cities.map(titleCase).join(", ");
}

export function addressOf(location: BusinessLocation | null): string | null {
  if (!location) return null;
  const street = [location.doorNo, location.building, location.street].filter(Boolean).join(", ");
  const place = [location.area, location.city].filter(Boolean).join(", ");
  return [street, place, `${location.state}${location.pincode ? ` ${location.pincode}` : ""}`].filter(Boolean).join("\n");
}

// The business profile form, shared by Add a business and Edit details.

export const PHONE = /^[6-9][0-9]{9}$/;
export const PINCODE = /^[1-9][0-9]{5}$/;
export const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const DESCRIPTION_MAX = 500;

/** Text as typed. */
export interface ProfileValues {
  name: string;
  phone: string;
  description: string;
  state: string;
  city: string;
  doorNo: string;
  building: string;
  street: string;
  area: string;
  pincode: string;
  point: { lat: number; lng: number } | null;
}

export type ProfileField = Exclude<keyof ProfileValues, "point">;
export type ProfileErrors = Partial<Record<ProfileField, string>>;

export const EMPTY_PROFILE: ProfileValues = {
  name: "",
  phone: "",
  description: "",
  state: "",
  city: "",
  doorNo: "",
  building: "",
  street: "",
  area: "",
  pincode: "",
  point: null,
};

export const profileOf = (b: Business): ProfileValues => ({
  name: b.name,
  phone: b.phone ?? "",
  description: b.description ?? "",
  state: b.location?.state ?? "",
  city: b.location?.city ?? "",
  doorNo: b.location?.doorNo ?? "",
  building: b.location?.building ?? "",
  street: b.location?.street ?? "",
  area: b.location?.area ?? "",
  pincode: b.location?.pincode ?? "",
  point: b.location?.point ?? null,
});

export function checkProfile(v: ProfileValues): ProfileErrors {
  const e: ProfileErrors = {};
  if (v.name.trim().length < 2) e.name = "Enter the business name.";
  if (!PHONE.test(v.phone)) e.phone = "Enter a 10-digit mobile number customers can call.";
  if (!v.state) e.state = "Choose the state.";
  if (v.city.trim().length < 2) e.city = "Choose or type the city.";
  if (v.pincode && !PINCODE.test(v.pincode)) e.pincode = "Enter the 6-digit PIN code, or leave it empty.";
  return e;
}

const orNull = (text: string) => text.trim() || null;

export const locationOf = (v: ProfileValues): LocationInput => ({
  state: v.state,
  city: v.city.trim(),
  doorNo: orNull(v.doorNo),
  building: orNull(v.building),
  street: orNull(v.street),
  area: orNull(v.area),
  pincode: orNull(v.pincode),
  point: v.point,
});

/** API field paths such as `body/location/state` to the form field they belong to. */
export function profileFieldOf(path: string | undefined): ProfileField | undefined {
  const last = path?.split("/").pop() ?? "";
  return (Object.keys(EMPTY_PROFILE) as (keyof ProfileValues)[]).find((k): k is ProfileField => k === last && k !== "point");
}
