import { normalizeFaceImagePayload } from "@/lib/face-image";

export type AuthUser = {
  id?: string;
  _id?: string;
  role?: string;
  roles?: string[];
  name?: string;
  mobile?: string;
  status?: string;
};

export class AuthError extends Error {
  readonly status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export type KycOverallStatus =
  | "pending"
  | "in_progress"
  | "pending_review"
  | "verified"
  | "rejected";

const KYC_OVERALL_STATUSES: KycOverallStatus[] = [
  "pending",
  "in_progress",
  "pending_review",
  "verified",
  "rejected",
];

export function isKycOverallStatus(value: string): value is KycOverallStatus {
  return KYC_OVERALL_STATUSES.includes(value as KycOverallStatus);
}

export type KycStepState = "pending" | "in_progress" | "verified" | "failed";

export type KycStepInfo = {
  status?: KycStepState;
  verified?: boolean;
};

export type VendorKycStatus = {
  status: KycOverallStatus;
  aadhaar?: KycStepInfo;
  pan?: KycStepInfo;
  face?: KycStepInfo;
  rejectReason?: string;
  reason?: string;
};

function readStep(raw: unknown): KycStepInfo | undefined {
  if (typeof raw === "string") {
    const value = raw.toLowerCase();
    const verified =
      value === "verified" || value === "completed" || value === "success" || value === "approved";
    return {
      status: verified ? "verified" : (value as KycStepState),
      verified,
    };
  }

  if (typeof raw === "boolean") {
    return { status: raw ? "verified" : "pending", verified: raw };
  }

  if (!raw || typeof raw !== "object") return undefined;

  const step = raw as Record<string, unknown>;
  const statusRaw = step.status ?? step.state ?? step.verificationStatus;
  let status: KycStepState | undefined;

  if (typeof statusRaw === "string") {
    const value = statusRaw.toLowerCase();
    if (value === "verified" || value === "completed" || value === "success" || value === "approved") {
      status = "verified";
    } else if (value === "failed" || value === "rejected") {
      status = "failed";
    } else if (value === "in_progress" || value === "processing") {
      status = "in_progress";
    } else if (value === "pending") {
      status = "pending";
    }
  }

  const verified = step.verified === true || step.isVerified === true || status === "verified";

  return { ...step, status: verified ? "verified" : status, verified };
}

export function normalizeVendorKycStatus(raw: unknown): VendorKycStatus {
  const data = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const nested =
    data.kyc && typeof data.kyc === "object" ? (data.kyc as Record<string, unknown>) : data;
  const steps =
    nested.steps && typeof nested.steps === "object"
      ? (nested.steps as Record<string, unknown>)
      : data.steps && typeof data.steps === "object"
        ? (data.steps as Record<string, unknown>)
        : undefined;

  const statusRaw = nested.status ?? data.status ?? nested.kycStatus ?? data.kycStatus;
  let status: KycOverallStatus = "pending";
  if (typeof statusRaw === "string") {
    const value = statusRaw.toLowerCase();
    if (value === "approved" || value === "completed" || value === "success") {
      status = "verified";
    } else if (isKycOverallStatus(value)) {
      status = value;
    }
  }

  const read = (key: "aadhaar" | "pan" | "face") => {
    const verifiedKey = `${key}Verified` as const;
    const statusKey = `${key}Status` as const;
    const fromSteps = steps?.[key];
    const fromVerified = nested[verifiedKey] ?? data[verifiedKey];
    const fromStatus = nested[statusKey] ?? data[statusKey];

    return readStep(
      nested[key] ??
        data[key] ??
        fromSteps ??
        (fromVerified === true ? "verified" : undefined) ??
        fromStatus,
    );
  };

  return {
    status,
    aadhaar: read("aadhaar"),
    pan: read("pan"),
    face: read("face"),
    rejectReason:
      typeof nested.rejectReason === "string"
        ? nested.rejectReason
        : typeof data.rejectReason === "string"
          ? data.rejectReason
          : undefined,
    reason:
      typeof nested.reason === "string"
        ? nested.reason
        : typeof data.reason === "string"
          ? data.reason
          : undefined,
  };
}

async function api(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  const body = init?.body;
  const method = init?.method ?? "GET";

  if (body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`/api/${path}`, {
    method,
    body,
    headers,
    cache: init?.cache,
    signal: init?.signal,
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const detail =
      (typeof data.message === "string" && data.message) ||
      (typeof data.error === "string" && data.error) ||
      (Array.isArray(data.errors) && data.errors[0]) ||
      (data.errors &&
        typeof data.errors === "object" &&
        Object.values(data.errors as Record<string, unknown>).find((v) => typeof v === "string"));

    if (res.status === 401) {
      throw new AuthError((detail as string | undefined) ?? "Session expired", 401);
    }
    if (res.status === 409) {
      const msg = typeof detail === "string" ? detail : "";
      if (/mobile already registered/i.test(msg)) {
        throw new Error("Oops! That number's already on Ruxstar — log in instead?");
      }
      throw new Error(msg || "That slot is no longer available. Please pick another time.");
    }
    if (res.status === 404) {
      throw new Error((detail as string | undefined) ?? "No account with that number — sign up first?");
    }
    throw new Error((detail as string | undefined) ?? `Request failed (${res.status})`);
  }

  return data;
}

async function authedApi(path: string, init?: RequestInit) {
  const token = getToken();
  if (!token) throw new Error("Please log in to continue.");

  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);

  return api(path, {
    ...init,
    headers,
  });
}

function postJson(path: string, body: unknown, init?: Omit<RequestInit, "method" | "body">) {
  return api(path, {
    ...init,
    method: "POST",
    body: JSON.stringify(body),
  });
}

function postAuthed(path: string, body: unknown) {
  return authedApi(path, { method: "POST", body: JSON.stringify(body) });
}

function postAuthedMethod(path: string, method: "POST" | "PATCH" | "PUT", body: unknown) {
  return authedApi(path, { method, body: JSON.stringify(body) });
}

export function postAuth(path: string, body: unknown) {
  return postJson(`auth/${path}`, body);
}

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("ruxstar_token");
}

export function getStoredUser<T = AuthUser>(): T | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("ruxstar_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function saveSession(token: string, user: unknown) {
  localStorage.setItem("ruxstar_token", token);
  localStorage.setItem("ruxstar_user", JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem("ruxstar_token");
  localStorage.removeItem("ruxstar_user");
}

/** Validate JWT with backend and refresh cached user from the database. */
export async function refreshSession(): Promise<AuthUser> {
  const token = getToken();
  if (!token) {
    throw new AuthError("Please log in to continue.", 401);
  }

  try {
    const data = await authedApi("auth/me");
    const payload = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
    const user = payload.user;

    if (!user || typeof user !== "object") {
      clearSession();
      throw new AuthError("Session invalid", 401);
    }

    saveSession(token, user);
    return user as AuthUser;
  } catch (err) {
    if (err instanceof AuthError) {
      clearSession();
    }
    throw err;
  }
}

/** @deprecated Use refreshSession — kept as a readable alias. */
export const getMe = refreshSession;

export async function logout() {
  const token = localStorage.getItem("ruxstar_token");
  if (token) {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // still clear local session
    }
  }
  clearSession();
}

export function getUserRole(user: AuthUser | null | undefined, fallback = "customer") {
  if (user?.role) return user.role.toLowerCase();
  const roles = user?.roles?.map((r) => r.toLowerCase()) ?? [];
  if (roles.includes("admin")) return "admin";
  if (roles.includes("employee")) return "employee";
  if (roles.includes("vendor")) return "vendor";
  if (roles.includes("delivery")) return "delivery";
  if (roles.length) return roles[0];
  return fallback;
}

export function isStaffUser(user: AuthUser | null | undefined) {
  const role = getUserRole(user);
  return role === "admin" || role === "employee";
}

export function homeForRole(role: string) {
  const r = role.toLowerCase();
  if (r === "vendor" || r === "business") return "/business";
  if (r === "delivery") return "/delivery";
  if (r === "admin" || r === "employee") return "/admin";
  return "/customer";
}

export function homeForUser(user: AuthUser | null | undefined, fallback = "customer") {
  return homeForRole(getUserRole(user, fallback));
}

function stepDone(step?: KycStepInfo) {
  return step?.verified === true || step?.status === "verified";
}

export function kycStepVisual(
  stepId: "aadhaar" | "pan" | "face",
  kyc: VendorKycStatus | null | undefined,
  currentStep: ReturnType<typeof nextKycStep>,
) {
  if (currentStep === stepId) return "active" as const;
  if (stepDone(kyc?.[stepId])) return "done" as const;
  return "upcoming" as const;
}

export function nextKycStep(kyc: VendorKycStatus | null | undefined) {
  if (!kyc) return "aadhaar" as const;
  if (kyc.status === "verified") return "done" as const;
  if (kyc.status === "pending_review") return "review" as const;
  if (!stepDone(kyc.aadhaar)) return "aadhaar" as const;
  if (!stepDone(kyc.pan)) return "pan" as const;
  if (!stepDone(kyc.face)) return "face" as const;
  if (kyc.status === "rejected") return "face" as const;
  return "review" as const;
}

export function vendorDestination(_kyc?: VendorKycStatus | null) {
  // Vendors always land on their dashboard; KYC is gated inside it.
  return "/business";
}

export async function getVendorKycStatus() {
  const data = await authedApi("vendor/kyc/status");
  return normalizeVendorKycStatus(data);
}

export type RuxstarCardData = {
  ruxstarId: string;
  name: string | null;
  mobile: string | null;
  aadhaar: string | null;
  pan: string | null;
  memberSince: string | null;
};

function formatRuxstarId(userId: string) {
  const hex = userId.replace(/[^a-f0-9]/gi, "").toUpperCase();
  const tail = hex.slice(-8).padStart(8, "0");
  return `RUX-${tail.slice(0, 4)}-${tail.slice(4, 8)}`;
}

function maskAadhaar(uid: unknown) {
  if (typeof uid !== "string" || uid.length < 4) return null;
  return `XXXX XXXX ${uid.slice(-4)}`;
}

function maskPan(pan: unknown) {
  if (typeof pan !== "string" || pan.length < 4) return null;
  return `${pan.slice(0, 2)}XXXX${pan.slice(-2)}`;
}

function parseMemberSince(raw: unknown): string | null {
  if (!raw) return null;
  const d = raw instanceof Date ? raw : new Date(String(raw));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** Build card display data from the logged-in user + verified KYC on file. */
export function buildRuxstarCardFromKyc(
  user: AuthUser | null | undefined,
  kyc: VendorKycStatus | null | undefined,
): RuxstarCardData | null {
  if (kyc?.status !== "verified") return null;

  const aadhaar = kyc.aadhaar as Record<string, unknown> | undefined;
  const pan = kyc.pan as Record<string, unknown> | undefined;
  const userId = user?.id ?? user?._id ?? "";

  const name =
    (typeof aadhaar?.name === "string" ? aadhaar.name : null) ??
    (typeof pan?.registeredName === "string" ? pan.registeredName : null) ??
    (typeof user?.name === "string" ? user.name : null);

  return {
    ruxstarId: userId ? formatRuxstarId(userId) : "RUX-0000-0000",
    name,
    mobile: typeof user?.mobile === "string" ? user.mobile : null,
    aadhaar: maskAadhaar(aadhaar?.uid),
    pan: maskPan(pan?.pan),
    memberSince: null,
  };
}

export async function getRuxstarCard(): Promise<RuxstarCardData> {
  const data = await authedApi("vendor/card");
  const card = asRecord(asRecord(data).card);
  return {
    ruxstarId: typeof card.ruxstarId === "string" ? card.ruxstarId : "RUX-0000-0000",
    name: typeof card.name === "string" ? card.name : null,
    mobile: typeof card.mobile === "string" ? card.mobile : null,
    aadhaar: typeof card.aadhaar === "string" ? card.aadhaar : null,
    pan: typeof card.pan === "string" ? card.pan : null,
    memberSince: parseMemberSince(card.memberSince),
  };
}

export function startAadhaarKyc(redirectUrl: string) {
  return authedApi("vendor/kyc/aadhaar/start", {
    method: "POST",
    body: JSON.stringify({ redirectUrl, userFlow: "signin" }),
  }) as Promise<{ url?: string }>;
}

export async function syncAadhaarKyc() {
  await authedApi("vendor/kyc/aadhaar/sync");
  return getVendorKycStatus();
}

export async function verifyPanKyc(pan: string) {
  await postAuthed("vendor/kyc/pan", { pan: pan.toUpperCase() });
  return getVendorKycStatus();
}

export async function verifyFaceKyc(image: string) {
  const payload = normalizeFaceImagePayload(image);
  await authedApi("vendor/kyc/face", {
    method: "POST",
    body: JSON.stringify({ image: payload }),
  });
  return getVendorKycStatus();
}

export function isAadhaarVerified(kyc: VendorKycStatus | null | undefined) {
  return stepDone(kyc?.aadhaar);
}

export async function resolvePostAuthPath(user: AuthUser | null | undefined, fallback = "customer") {
  return homeForUser(user, fallback);
}

/* ------------------------------------------------------------------ */
/* Customer profile + role switching                                   */
/* ------------------------------------------------------------------ */

export type CustomerProfile = {
  id?: string;
  name?: string;
  mobile?: string;
  roles?: string[];
};

export async function getCustomerProfile(): Promise<CustomerProfile> {
  const data = await authedApi("user/profile");
  const user = asRecord(asRecord(data).user);
  return {
    id: typeof user._id === "string" ? user._id : typeof user.id === "string" ? user.id : undefined,
    name: typeof user.name === "string" ? user.name : undefined,
    mobile: typeof user.mobile === "string" ? user.mobile : undefined,
    roles: Array.isArray(user.roles) ? (user.roles as string[]) : undefined,
  };
}

export async function updateCustomerProfile(name: string): Promise<CustomerProfile> {
  const data = await postAuthedMethod("user/profile", "PATCH", { name });
  const user = asRecord(asRecord(data).user);
  return {
    id: typeof user._id === "string" ? user._id : typeof user.id === "string" ? user.id : undefined,
    name: typeof user.name === "string" ? user.name : undefined,
    mobile: typeof user.mobile === "string" ? user.mobile : undefined,
    roles: Array.isArray(user.roles) ? (user.roles as string[]) : undefined,
  };
}

/** Customer → vendor. Saves the refreshed session and returns the new user. */
export async function becomeVendor(businessName?: string): Promise<AuthUser> {
  const data = await postAuthed("user/become-vendor", businessName ? { businessName } : {});
  const payload = asRecord(data);
  const token = typeof payload.token === "string" ? payload.token : getToken();
  const user = payload.user as AuthUser | undefined;
  if (token && user) saveSession(token, user);
  return (user ?? {}) as AuthUser;
}

/** Vendor → customer. Saves the refreshed session and returns the new user. */
export async function becomeCustomer(): Promise<AuthUser> {
  const data = await postAuthed("vendor/become-customer", {});
  const payload = asRecord(data);
  const token = typeof payload.token === "string" ? payload.token : getToken();
  const user = payload.user as AuthUser | undefined;
  if (token && user) saveSession(token, user);
  return (user ?? {}) as AuthUser;
}

/* ------------------------------------------------------------------ */
/* Vendor business profile + customers (KYC-verified only)             */
/* ------------------------------------------------------------------ */

export type VendorProfile = {
  businessName?: string;
  category?: string;
  description?: string;
  phone?: string;
  address?: string;
};

export class KycRequiredError extends Error {
  constructor() {
    super("Complete KYC to manage your business.");
    this.name = "KycRequiredError";
  }
}

function readVendorProfile(raw: unknown): VendorProfile {
  const profile = asRecord(asRecord(raw).profile);
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  return {
    businessName: str(profile.businessName),
    category: str(profile.category),
    description: str(profile.description),
    phone: str(profile.phone),
    address: str(profile.address),
  };
}

export async function getVendorProfile(): Promise<VendorProfile> {
  try {
    return readVendorProfile(await authedApi("vendor/profile"));
  } catch (err) {
    if (err instanceof Error && err.message.includes("kyc")) throw new KycRequiredError();
    throw err;
  }
}

export async function updateVendorProfile(patch: VendorProfile): Promise<VendorProfile> {
  try {
    return readVendorProfile(await postAuthedMethod("vendor/profile", "PATCH", patch));
  } catch (err) {
    if (err instanceof Error && err.message.includes("kyc")) throw new KycRequiredError();
    throw err;
  }
}


/* ------------------------------------------------------------------ */
/* Vendor businesses (multi-business, KYC-verified only)               */
/* ------------------------------------------------------------------ */

export type BusinessModule =
  | "events"
  | "appointments"
  | "services"
  | "commerce"
  | "creator"
  | "print";

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type DayHours = {
  open: string;
  close: string;
  closed: boolean;
};

export type WeeklyHours = Record<DayKey, DayHours>;

export type BusinessResource = {
  id: string;
  name: string;
  capacity?: number;
  description?: string;
  pricePerSlot?: number;
};

export type BusinessPhoto = {
  id: string;
  mimeType: string;
  url: string;
  createdAt?: string;
};

export type BusinessStaff = {
  id: string;
  name: string;
  role?: string;
};

export type BusinessService = {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
  staffIds: string[];
  description?: string;
};

export type BusinessSetup = {
  photos: BusinessPhoto[];
  weeklyHours: WeeklyHours;
  slotMinutes: number;
  pricePerSlot: number;
  resources: BusinessResource[];
  services: BusinessService[];
  staff: BusinessStaff[];
  bufferMinutes: number;
  bookingMode?: "slots" | "fullDay" | "services";
  maxGuests?: number | null;
  venueRules?: string;
  printProfile?: PrintProfile;
};

const BUSINESS_MODULES: BusinessModule[] = [
  "events",
  "appointments",
  "services",
  "commerce",
  "creator",
  "print",
];

export type PricingTier = { minQty?: number; minPages?: number; unitPrice: number };

export type PricingAddons = {
  sides?: Record<string, number>;
  size?: Record<string, number>;
  printType?: Record<string, number>;
  material?: Record<string, number>;
  color?: Record<string, number>;
  doubleSided?: number;
  binding?: Record<string, number>;
  paperSize?: Record<string, number>;
};

/** A vendor's fixed price config for one product category. */
export type CategoryPricing = {
  enabled: boolean;
  minQuantity: number;
  turnaroundDays: number;
  basePrice?: number; // per_unit
  perPage?: { bw: number; color: number }; // per_page (documents)
  addons?: PricingAddons;
  tiers?: PricingTier[];
};

export type PrintProfile = {
  serviceCategories: string[];
  cities: string[];
  serveAll: boolean;
  turnaroundDays: number;
  minOrderValue: number;
  notes: string;
  acceptingOrders: boolean;
  pricing: Record<string, CategoryPricing>;
};

export function defaultPrintProfile(): PrintProfile {
  return {
    serviceCategories: [],
    cities: [],
    serveAll: false,
    turnaroundDays: 3,
    minOrderValue: 0,
    notes: "",
    acceptingOrders: true,
    pricing: {},
  };
}

export function defaultCategoryPricing(pricingModel: string, minQuantity = 1): CategoryPricing {
  const base: CategoryPricing = { enabled: true, minQuantity, turnaroundDays: 3, addons: {}, tiers: [] };
  if (pricingModel === "per_page") base.perPage = { bw: 0, color: 0 };
  else base.basePrice = 0;
  return base;
}

export type Business = {
  id: string;
  name: string;
  typeId: string;
  categoryId: string;
  typeLabel: string;
  categoryLabel: string;
  module: BusinessModule;
  phone: string;
  address: string;
  description: string;
  thumbnailUrl?: string;
  thumbnailPhotoId?: string;
  status: "draft" | "live";
  setupComplete: boolean;
  setup?: BusinessSetup;
  createdAt: string;
  updatedAt?: string;
};

export function businessPhotoUrl(businessId: string, photoId: string): string {
  return `/api/public/businesses/${businessId}/photos/${photoId}`;
}

/** Profile thumbnail — from create step or first setup photo. */
export function businessThumbnailUrl(
  biz: Pick<Business, "id" | "thumbnailUrl" | "thumbnailPhotoId" | "setup">,
): string | undefined {
  const direct = biz.thumbnailUrl?.trim();
  if (direct) return direct;
  const photoId = biz.thumbnailPhotoId?.trim() || biz.setup?.photos?.[0]?.id?.trim();
  if (photoId && biz.id) return businessPhotoUrl(biz.id, photoId);
  const fromSetup = biz.setup?.photos?.[0]?.url?.trim();
  return fromSetup || undefined;
}

/** All candidate URLs to try when loading a business thumbnail. */
export function businessThumbnailCandidates(
  biz: Pick<Business, "id" | "thumbnailUrl" | "thumbnailPhotoId" | "setup">,
): string[] {
  const urls = new Set<string>();
  const primary = businessThumbnailUrl(biz);
  if (primary) urls.add(primary);
  const photoId = biz.thumbnailPhotoId?.trim() || biz.setup?.photos?.[0]?.id?.trim();
  if (photoId && biz.id) urls.add(businessPhotoUrl(biz.id, photoId));
  const setupUrl = biz.setup?.photos?.[0]?.url?.trim();
  if (setupUrl) urls.add(setupUrl);
  return [...urls];
}

export type BusinessInput = {
  name: string;
  typeId: string;
  phone?: string;
  address?: string;
  description: string;
  thumbnail: string;
  bookingMode?: "slots" | "fullDay" | "services";
};

function normalizeDayHours(raw: unknown, fallback: DayHours): DayHours {
  const row = asRecord(raw);
  const closed = row.closed === true;
  const open = typeof row.open === "string" ? row.open : fallback.open;
  const close = typeof row.close === "string" ? row.close : fallback.close;
  return { open, close, closed };
}

function normalizeWeeklyHours(raw: unknown): WeeklyHours | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const src = raw as Record<string, unknown>;
  const base: DayHours = { open: "09:00", close: "21:00", closed: false };
  const days: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const out = {} as WeeklyHours;
  for (const day of days) {
    out[day] = normalizeDayHours(src[day], day === "sun" ? { ...base, closed: true } : base);
  }
  return out;
}

function businessPhotoDisplayUrl(businessId: string, photoId: string): string {
  return businessPhotoUrl(businessId, photoId);
}

function normalizeSetup(raw: unknown, businessId?: string): BusinessSetup | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const s = asRecord(raw);
  const photosRaw = s.photos;
  const photos: BusinessPhoto[] = Array.isArray(photosRaw)
    ? photosRaw.flatMap((p) => {
        const photo = asRecord(p);
        const id = typeof photo.id === "string" ? photo.id : "";
        const url =
          id && businessId
            ? businessPhotoDisplayUrl(businessId, id)
            : typeof photo.url === "string"
              ? photo.url
              : "";
        if (!id || !url) return [];
        return [
          {
            id,
            mimeType: typeof photo.mimeType === "string" ? photo.mimeType : "image/jpeg",
            url,
            ...(typeof photo.createdAt === "string" ? { createdAt: photo.createdAt } : {}),
          },
        ];
      })
    : [];
  const resourcesRaw = s.resources;
  const resources = Array.isArray(resourcesRaw)
    ? resourcesRaw
        .map((r) => {
          const res = asRecord(r);
          const id = typeof res.id === "string" ? res.id : "";
          const name = typeof res.name === "string" ? res.name : "";
          if (!id || !name) return null;
          const capacity =
            typeof res.capacity === "number" && res.capacity > 0 ? res.capacity : undefined;
          const description =
            typeof res.description === "string" && res.description.trim()
              ? res.description.trim()
              : undefined;
          return { id, name, ...(capacity ? { capacity } : {}), ...(description ? { description } : {}) };
        })
        .filter((r): r is BusinessResource => r !== null)
    : [];

  const staff = normalizeStaffList(s.staff);
  const services = normalizeServiceList(s.services);

  const bookingMode =
    s.bookingMode === "fullDay" ? "fullDay" : s.bookingMode === "services" ? "services" : "slots";
  const maxGuestsRaw = s.maxGuests;
  const maxGuests =
    typeof maxGuestsRaw === "number" && maxGuestsRaw > 0 ? Math.round(maxGuestsRaw) : null;

  return {
    photos,
    weeklyHours: normalizeWeeklyHours(s.weeklyHours) ?? {
      mon: { open: "09:00", close: "21:00", closed: false },
      tue: { open: "09:00", close: "21:00", closed: false },
      wed: { open: "09:00", close: "21:00", closed: false },
      thu: { open: "09:00", close: "21:00", closed: false },
      fri: { open: "09:00", close: "21:00", closed: false },
      sat: { open: "09:00", close: "21:00", closed: false },
      sun: { open: "09:00", close: "21:00", closed: true },
    },
    slotMinutes: typeof s.slotMinutes === "number" ? s.slotMinutes : 60,
    pricePerSlot: typeof s.pricePerSlot === "number" ? s.pricePerSlot : 0,
    resources,
    services,
    staff,
    bufferMinutes:
      typeof s.bufferMinutes === "number" && s.bufferMinutes >= 0 ? Math.round(s.bufferMinutes) : 0,
    bookingMode,
    maxGuests,
    venueRules: typeof s.venueRules === "string" ? s.venueRules : "",
    printProfile: normalizePrintProfile(s.printProfile),
  };
}

function normalizePrintProfile(raw: unknown): PrintProfile {
  const p = asRecord(raw);
  const strList = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  const num = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.round(v) : fallback;
  return {
    serviceCategories: strList(p.serviceCategories),
    cities: strList(p.cities),
    serveAll: p.serveAll === true,
    turnaroundDays: num(p.turnaroundDays, 3),
    minOrderValue: num(p.minOrderValue, 0),
    notes: typeof p.notes === "string" ? p.notes : "",
    acceptingOrders: p.acceptingOrders !== false,
    pricing: normalizePricingMap(p.pricing),
  };
}

function normalizeMoneyMap(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  const rec = asRecord(raw);
  for (const [k, v] of Object.entries(rec)) {
    const n = Math.round(Number(v));
    if (Number.isFinite(n) && n > 0) out[k] = n;
  }
  return out;
}

function normalizeCategoryPricing(raw: unknown): CategoryPricing {
  const p = asRecord(raw);
  const num = (v: unknown, fallback: number) =>
    Number.isFinite(Number(v)) ? Math.round(Number(v)) : fallback;
  const addonsRaw = asRecord(p.addons);
  const addons: PricingAddons = {
    sides: normalizeMoneyMap(addonsRaw.sides),
    size: normalizeMoneyMap(addonsRaw.size),
    printType: normalizeMoneyMap(addonsRaw.printType),
    material: normalizeMoneyMap(addonsRaw.material),
    color: normalizeMoneyMap(addonsRaw.color),
    binding: normalizeMoneyMap(addonsRaw.binding),
    paperSize: normalizeMoneyMap(addonsRaw.paperSize),
    doubleSided: num(addonsRaw.doubleSided, 0),
  };
  const perPageRaw = asRecord(p.perPage);
  const tiers = Array.isArray(p.tiers)
    ? p.tiers
        .map((t) => {
          const tr = asRecord(t);
          const unitPrice = num(tr.unitPrice, 0);
          const minQty = num(tr.minQty, 0);
          const minPages = num(tr.minPages, 0);
          if (unitPrice <= 0) return null;
          return {
            unitPrice,
            ...(minQty > 0 ? { minQty } : {}),
            ...(minPages > 0 ? { minPages } : {}),
          } as PricingTier;
        })
        .filter((t): t is PricingTier => t !== null)
    : [];
  return {
    enabled: p.enabled !== false,
    minQuantity: Math.max(1, num(p.minQuantity, 1)),
    turnaroundDays: num(p.turnaroundDays, 3),
    ...(p.basePrice !== undefined ? { basePrice: num(p.basePrice, 0) } : {}),
    ...(p.perPage !== undefined
      ? { perPage: { bw: num(perPageRaw.bw, 0), color: num(perPageRaw.color, 0) } }
      : {}),
    addons,
    tiers,
  };
}

function normalizePricingMap(raw: unknown): Record<string, CategoryPricing> {
  const out: Record<string, CategoryPricing> = {};
  const rec = asRecord(raw);
  for (const [k, v] of Object.entries(rec)) {
    out[k] = normalizeCategoryPricing(v);
  }
  return out;
}

function normalizeStaffList(raw: unknown): BusinessStaff[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      const st = asRecord(r);
      const id = typeof st.id === "string" ? st.id : "";
      const name = typeof st.name === "string" ? st.name : "";
      if (!id || !name) return null;
      const role = typeof st.role === "string" && st.role.trim() ? st.role.trim() : undefined;
      return { id, name, ...(role ? { role } : {}) };
    })
    .filter((s): s is BusinessStaff => s !== null);
}

function normalizeServiceList(raw: unknown): BusinessService[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      const sv = asRecord(r);
      const id = typeof sv.id === "string" ? sv.id : "";
      const name = typeof sv.name === "string" ? sv.name : "";
      if (!id || !name) return null;
      const durationMinutes =
        typeof sv.durationMinutes === "number" && sv.durationMinutes > 0
          ? Math.round(sv.durationMinutes)
          : 30;
      const price = typeof sv.price === "number" && sv.price >= 0 ? Math.round(sv.price) : 0;
      const staffIds = Array.isArray(sv.staffIds)
        ? sv.staffIds.filter((x): x is string => typeof x === "string")
        : [];
      const description =
        typeof sv.description === "string" && sv.description.trim()
          ? sv.description.trim()
          : undefined;
      return { id, name, durationMinutes, price, staffIds, ...(description ? { description } : {}) };
    })
    .filter((s): s is BusinessService => s !== null);
}

function normalizeBusiness(raw: unknown): Business {
  const b = asRecord(raw);
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const id = str(b._id) || str(b.id);
  const module = BUSINESS_MODULES.includes(b.module as BusinessModule)
    ? (b.module as BusinessModule)
    : "commerce";
  const setup = normalizeSetup(b.setup, id);
  const thumbnailPhotoId = str(b.thumbnailPhotoId) || setup?.photos?.[0]?.id || undefined;
  const thumbnailUrl =
    str(b.thumbnailUrl) ||
    (thumbnailPhotoId && id ? businessPhotoUrl(id, thumbnailPhotoId) : "") ||
    setup?.photos?.[0]?.url ||
    undefined;
  return {
    id,
    name: str(b.name),
    typeId: str(b.typeId),
    categoryId: str(b.categoryId),
    typeLabel: str(b.typeLabel),
    categoryLabel: str(b.categoryLabel),
    module,
    phone: str(b.phone),
    address: str(b.address),
    description: str(b.description),
    thumbnailUrl: thumbnailUrl || undefined,
    thumbnailPhotoId: thumbnailPhotoId || undefined,
    status: b.status === "live" ? "live" : "draft",
    setupComplete: b.setupComplete === true,
    setup,
    createdAt: str(b.createdAt) || new Date().toISOString(),
    updatedAt: str(b.updatedAt) || undefined,
  };
}

function mapKycError(err: unknown): never {
  if (err instanceof Error && err.message.toLowerCase().includes("kyc")) {
    throw new KycRequiredError();
  }
  throw err;
}

export async function listBusinesses(): Promise<Business[]> {
  try {
    const data = await authedApi("vendor/businesses");
    const list = asRecord(data).businesses;
    return Array.isArray(list) ? list.map(normalizeBusiness) : [];
  } catch (err) {
    return mapKycError(err);
  }
}

export async function getBusiness(id: string): Promise<Business> {
  try {
    const data = await authedApi(`vendor/businesses/${id}`);
    return normalizeBusiness(asRecord(data).business);
  } catch (err) {
    return mapKycError(err);
  }
}

export async function createBusiness(input: BusinessInput): Promise<Business> {
  try {
    const data = await postAuthed("vendor/businesses", input);
    return normalizeBusiness(asRecord(data).business);
  } catch (err) {
    return mapKycError(err);
  }
}

/** Upload or replace the business profile thumbnail (all modules). */
export async function uploadBusinessThumbnail(id: string, image: string): Promise<Business> {
  try {
    const data = await postAuthed(`vendor/businesses/${id}/thumbnail`, { image });
    return normalizeBusiness(asRecord(data).business);
  } catch (err) {
    return mapKycError(err);
  }
}

export async function updateBusiness(
  id: string,
  patch: Partial<BusinessInput>,
): Promise<Business> {
  try {
    const data = await postAuthedMethod(`vendor/businesses/${id}`, "PATCH", patch);
    return normalizeBusiness(asRecord(data).business);
  } catch (err) {
    return mapKycError(err);
  }
}

export async function deleteBusiness(id: string): Promise<void> {
  try {
    await authedApi(`vendor/businesses/${id}`, { method: "DELETE" });
  } catch (err) {
    return mapKycError(err);
  }
}

export type BusinessSetupInput = {
  weeklyHours?: WeeklyHours;
  slotMinutes?: number;
  pricePerSlot?: number;
  resources?: BusinessResource[];
  services?: BusinessService[];
  staff?: BusinessStaff[];
  bufferMinutes?: number;
  bookingMode?: "slots" | "fullDay" | "services";
  maxGuests?: number | null;
  venueRules?: string;
  printProfile?: PrintProfile;
};

export async function getBusinessSetup(id: string): Promise<Business> {
  try {
    const data = await authedApi(`vendor/businesses/${id}/setup`);
    return normalizeBusiness(asRecord(data).business);
  } catch (err) {
    return mapKycError(err);
  }
}

export async function updateBusinessSetup(id: string, patch: BusinessSetupInput): Promise<Business> {
  try {
    const data = await postAuthedMethod(`vendor/businesses/${id}/setup`, "PATCH", patch);
    return normalizeBusiness(asRecord(data).business);
  } catch (err) {
    return mapKycError(err);
  }
}

export async function syncBusinessSetupPhotos(
  id: string,
  payload: { images: string[]; removeIds?: string[] },
): Promise<Business> {
  try {
    const data = await postAuthed(`vendor/businesses/${id}/setup/photos/sync`, payload);
    return normalizeBusiness(asRecord(data).business);
  } catch (err) {
    return mapKycError(err);
  }
}

export async function addBusinessSetupPhoto(id: string, image: string): Promise<Business> {
  try {
    const data = await postAuthed(`vendor/businesses/${id}/setup/photos`, { image });
    return normalizeBusiness(asRecord(data).business);
  } catch (err) {
    return mapKycError(err);
  }
}

export async function removeBusinessSetupPhoto(id: string, photoId: string): Promise<Business> {
  try {
    const data = await authedApi(`vendor/businesses/${id}/setup/photos/${photoId}`, {
      method: "DELETE",
    });
    return normalizeBusiness(asRecord(data).business);
  } catch (err) {
    return mapKycError(err);
  }
}

export async function completeBusinessSetup(id: string): Promise<Business> {
  try {
    const data = await postAuthed(`vendor/businesses/${id}/setup/complete`, {});
    return normalizeBusiness(asRecord(data).business);
  } catch (err) {
    return mapKycError(err);
  }
}

/** Toggle a print shop's "Accepting orders" availability. */
export async function setPrintAcceptingOrders(id: string, accepting: boolean): Promise<Business> {
  try {
    const data = await postAuthed(`pod/vendor/businesses/${id}/accepting`, { accepting });
    return normalizeBusiness(asRecord(data).business);
  } catch (err) {
    return mapKycError(err);
  }
}

/* ------------------------------------------------------------------ */
/* Business slots (generated from setup + vendor block/unblock)        */
/* ------------------------------------------------------------------ */

export type SlotStatus = "available" | "blocked" | "booked" | "unavailable";

export type BusinessSlot = {
  id: string;
  resourceId: string;
  resourceName: string;
  staffId?: string;
  staffName?: string;
  durationMinutes?: number;
  date: string;
  startTime: string;
  endTime: string;
  startAt: string;
  endAt: string;
  pricePerSlot: number;
  basePricePerSlot?: number;
  status: SlotStatus;
  booking?: {
    customerName?: string;
    customerMobile?: string;
  };
};

export type BusinessSlotsResponse = {
  businessId: string;
  from: string;
  to: string;
  timezone: string;
  slotMinutes: number;
  pricePerSlot: number;
  bookingMode?: "slots" | "fullDay" | "services";
  resources: BusinessResource[];
  services?: BusinessService[];
  staff?: BusinessStaff[];
  bufferMinutes?: number;
  selectedServiceIds?: string[];
  durationMinutes?: number;
  slots: BusinessSlot[];
};

function normalizeSlot(raw: unknown): BusinessSlot | null {
  const s = asRecord(raw);
  const id = typeof s.id === "string" ? s.id : "";
  const resourceId = typeof s.resourceId === "string" ? s.resourceId : "";
  const startAt = typeof s.startAt === "string" ? s.startAt : "";
  if (!id || !resourceId || !startAt) return null;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const statusRaw = str(s.status);
  const status: SlotStatus =
    statusRaw === "booked"
      ? "booked"
      : statusRaw === "blocked"
        ? "blocked"
        : statusRaw === "unavailable"
          ? "unavailable"
          : "available";
  return {
    id,
    resourceId,
    resourceName: str(s.resourceName),
    staffId: typeof s.staffId === "string" ? s.staffId : undefined,
    staffName: typeof s.staffName === "string" ? s.staffName : undefined,
    durationMinutes:
      typeof s.durationMinutes === "number" ? Math.round(s.durationMinutes) : undefined,
    date: str(s.date),
    startTime: str(s.startTime),
    endTime: str(s.endTime),
    startAt,
    endAt: str(s.endAt),
    pricePerSlot: typeof s.pricePerSlot === "number" ? s.pricePerSlot : 0,
    basePricePerSlot:
      typeof s.basePricePerSlot === "number" ? s.basePricePerSlot : undefined,
    status,
    booking:
      s.booking && typeof s.booking === "object"
        ? {
            customerName:
              typeof (s.booking as Record<string, unknown>).customerName === "string"
                ? ((s.booking as Record<string, unknown>).customerName as string)
                : undefined,
            customerMobile:
              typeof (s.booking as Record<string, unknown>).customerMobile === "string"
                ? ((s.booking as Record<string, unknown>).customerMobile as string)
                : undefined,
          }
        : undefined,
  };
}

function normalizeBusinessResource(raw: unknown): BusinessResource | null {
  const res = asRecord(raw);
  const id = typeof res.id === "string" ? res.id : "";
  const name = typeof res.name === "string" ? res.name : "";
  if (!id || !name) return null;
  const capacity = typeof res.capacity === "number" && res.capacity > 0 ? res.capacity : undefined;
  const description =
    typeof res.description === "string" && res.description.trim() ? res.description.trim() : undefined;
  const pricePerSlot =
    typeof res.pricePerSlot === "number" && res.pricePerSlot >= 0
      ? Math.round(res.pricePerSlot)
      : undefined;
  return {
    id,
    name,
    ...(capacity ? { capacity } : {}),
    ...(description ? { description } : {}),
    ...(pricePerSlot != null ? { pricePerSlot } : {}),
  };
}

function normalizeSlotsResponse(raw: unknown): BusinessSlotsResponse {
  const data = asRecord(raw);
  const slotsRaw = data.slots;
  const resourcesRaw = data.resources;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    businessId: str(data.businessId),
    from: str(data.from),
    to: str(data.to),
    timezone: str(data.timezone) || "Asia/Kolkata",
    slotMinutes: typeof data.slotMinutes === "number" ? data.slotMinutes : 60,
    pricePerSlot: typeof data.pricePerSlot === "number" ? data.pricePerSlot : 0,
    bookingMode:
      data.bookingMode === "fullDay"
        ? "fullDay"
        : data.bookingMode === "services"
          ? "services"
          : "slots",
    resources: Array.isArray(resourcesRaw)
      ? resourcesRaw.map(normalizeBusinessResource).filter((r): r is BusinessResource => r !== null)
      : [],
    services: normalizeServiceList(data.services),
    staff: normalizeStaffList(data.staff),
    bufferMinutes:
      typeof data.bufferMinutes === "number" && data.bufferMinutes >= 0
        ? Math.round(data.bufferMinutes)
        : 0,
    selectedServiceIds: Array.isArray(data.selectedServiceIds)
      ? data.selectedServiceIds.filter((x): x is string => typeof x === "string")
      : [],
    durationMinutes:
      typeof data.durationMinutes === "number" ? Math.round(data.durationMinutes) : 0,
    slots: Array.isArray(slotsRaw)
      ? slotsRaw.map(normalizeSlot).filter((s): s is BusinessSlot => s !== null)
      : [],
  };
}

export async function listBusinessSlots(
  businessId: string,
  params: { from: string; to: string; resourceId?: string; serviceIds?: string[]; staffId?: string },
): Promise<BusinessSlotsResponse> {
  try {
    const qs = new URLSearchParams({ from: params.from, to: params.to });
    if (params.resourceId) qs.set("resourceId", params.resourceId);
    if (params.serviceIds?.length) qs.set("serviceIds", params.serviceIds.join(","));
    if (params.staffId) qs.set("staffId", params.staffId);
    const data = await authedApi(`vendor/businesses/${businessId}/slots?${qs}`);
    return normalizeSlotsResponse(data);
  } catch (err) {
    return mapKycError(err);
  }
}

export async function blockBusinessSlot(
  businessId: string,
  body: { resourceId: string; startAt: string },
): Promise<void> {
  try {
    await postAuthed(`vendor/businesses/${businessId}/slots/block`, body);
  } catch (err) {
    return mapKycError(err);
  }
}

export async function unblockBusinessSlot(
  businessId: string,
  body: { resourceId: string; startAt: string },
): Promise<void> {
  try {
    await postAuthed(`vendor/businesses/${businessId}/slots/unblock`, body);
  } catch (err) {
    return mapKycError(err);
  }
}

export async function setBusinessSlotPrice(
  businessId: string,
  body: { resourceId: string; startAt: string; pricePerSlot: number },
): Promise<void> {
  try {
    await postAuthed(`vendor/businesses/${businessId}/slots/price`, body);
  } catch (err) {
    return mapKycError(err);
  }
}

export async function clearBusinessSlotPrice(
  businessId: string,
  body: { resourceId: string; startAt: string },
): Promise<void> {
  try {
    await postAuthed(`vendor/businesses/${businessId}/slots/price/clear`, body);
  } catch (err) {
    return mapKycError(err);
  }
}

/* ------------------------------------------------------------------ */
/* Public booking + customer bookings (Phase 4)                        */
/* ------------------------------------------------------------------ */

export type PublicBusiness = {
  id: string;
  name: string;
  typeId: string;
  typeLabel: string;
  categoryLabel: string;
  phone: string;
  address: string;
  description: string;
  setup: {
    photos: BusinessPhoto[];
    slotMinutes: number;
    pricePerSlot: number;
    resources: BusinessResource[];
    services: BusinessService[];
    staff: BusinessStaff[];
    bufferMinutes: number;
    bookingMode?: "slots" | "fullDay" | "services";
    maxGuests?: number | null;
    venueRules?: string;
  };
};

export type PublicBusinessSummary = {
  id: string;
  name: string;
  vendorName: string;
  typeLabel: string;
  categoryLabel: string;
  module: BusinessModule;
  address: string;
  description: string;
  pricePerSlot: number;
  slotMinutes: number;
  bookingMode: "slots" | "fullDay" | "services";
  maxGuests: number | null;
  resourceCount: number;
  priceFrom: number;
  priceTo: number;
  coverUrl?: string;
};

function normalizePublicBusinessSummary(raw: unknown): PublicBusinessSummary | null {
  const b = asRecord(raw);
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const num = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;
  const id = str(b._id) || str(b.id);
  if (!id) return null;
  const module = BUSINESS_MODULES.includes(b.module as BusinessModule)
    ? (b.module as BusinessModule)
    : "appointments";
  const pricePerSlot = num(b.pricePerSlot, 0);
  const thumbnailUrl = str(b.thumbnailUrl).trim();
  const thumbnailPhotoId = str(b.thumbnailPhotoId).trim();
  const coverPhotoUrl = str(b.coverPhotoUrl).trim();
  const coverPhotoId = str(b.coverPhotoId).trim();
  const coverUrl =
    str(b.coverUrl).trim() ||
    thumbnailUrl ||
    coverPhotoUrl ||
    (thumbnailPhotoId ? businessPhotoUrl(id, thumbnailPhotoId) : undefined) ||
    (coverPhotoId ? businessPhotoUrl(id, coverPhotoId) : undefined) ||
    undefined;
  return {
    id,
    name: str(b.name),
    vendorName: str(b.vendorName),
    typeLabel: str(b.typeLabel),
    categoryLabel: str(b.categoryLabel),
    module,
    address: str(b.address),
    description: str(b.description),
    pricePerSlot,
    slotMinutes: num(b.slotMinutes, 60),
    bookingMode:
      b.bookingMode === "fullDay" ? "fullDay" : b.bookingMode === "services" ? "services" : "slots",
    maxGuests:
      typeof b.maxGuests === "number" && Number.isFinite(b.maxGuests) ? b.maxGuests : null,
    resourceCount: num(b.resourceCount, 0),
    priceFrom: num(b.priceFrom, pricePerSlot),
    priceTo: num(b.priceTo, pricePerSlot),
    coverUrl: coverUrl || undefined,
  };
}

export async function listPublicBusinesses(): Promise<PublicBusinessSummary[]> {
  const res = await fetch("/api/public/businesses", { cache: "no-store" });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const detail =
      (typeof data.message === "string" && data.message) ||
      (typeof data.error === "string" && data.error);
    if (res.status === 404) {
      throw new Error(
        detail ?? "Business listing is not available yet. Refresh in a moment or try again.",
      );
    }
    throw new Error(detail ?? `Could not load businesses (${res.status})`);
  }

  const list = asRecord(data).businesses;
  return Array.isArray(list)
    ? list.map(normalizePublicBusinessSummary).filter((b): b is PublicBusinessSummary => b !== null)
    : [];
}

export type CustomerBooking = {
  id: string;
  businessId: string;
  businessName: string;
  typeLabel: string;
  resourceId: string;
  resourceName: string;
  services?: { id: string; name: string }[];
  serviceLabel?: string;
  durationMinutes?: number | null;
  startAt: string;
  endAt: string;
  pricePerSlot: number;
  amount?: number;
  currency?: string;
  customerName: string;
  customerMobile: string;
  status: string;
  paymentStatus?: string | null;
  expiresAt?: string | null;
  paidAt?: string | null;
  createdAt?: string;
};

export type InitiateBookingPayment = {
  orderId: string;
  cashfreeOrderId: string;
  paymentSessionId: string;
  amount: number;
  currency: string;
  expiresAt: string;
  mode: "sandbox" | "production";
};

export type InitiateBookingResult = {
  booking: CustomerBooking;
  payment: InitiateBookingPayment;
};

function normalizePublicBusiness(raw: unknown): PublicBusiness {
  const b = asRecord(raw);
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const id = str(b._id) || str(b.id);
  const setup = normalizeSetup(b.setup, id);
  return {
    id,
    name: str(b.name),
    typeId: str(b.typeId),
    typeLabel: str(b.typeLabel),
    categoryLabel: str(b.categoryLabel),
    phone: str(b.phone),
    address: str(b.address),
    description: str(b.description),
    setup: {
      photos: setup?.photos ?? [],
      slotMinutes: setup?.slotMinutes ?? 60,
      pricePerSlot: setup?.pricePerSlot ?? 0,
      resources: setup?.resources ?? [],
      services: setup?.services ?? [],
      staff: setup?.staff ?? [],
      bufferMinutes: setup?.bufferMinutes ?? 0,
      bookingMode: setup?.bookingMode ?? "slots",
      maxGuests: setup?.maxGuests ?? null,
      venueRules: setup?.venueRules ?? "",
    },
  };
}

function normalizeCustomerBooking(raw: unknown): CustomerBooking | null {
  const b = asRecord(raw);
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const id = str(b.id) || str(b._id);
  if (!id) return null;
  return {
    id,
    businessId: str(b.businessId),
    businessName: str(b.businessName),
    typeLabel: str(b.typeLabel),
    resourceId: str(b.resourceId),
    resourceName: str(b.resourceName),
    services: Array.isArray(b.services)
      ? b.services
          .map((sv) => {
            const r = asRecord(sv);
            return { id: str(r.id), name: str(r.name) };
          })
          .filter((sv) => sv.name)
      : [],
    serviceLabel: typeof b.serviceLabel === "string" ? b.serviceLabel : "",
    durationMinutes: typeof b.durationMinutes === "number" ? b.durationMinutes : null,
    startAt: str(b.startAt),
    endAt: str(b.endAt),
    pricePerSlot: typeof b.pricePerSlot === "number" ? b.pricePerSlot : 0,
    amount: typeof b.amount === "number" ? b.amount : undefined,
    currency: typeof b.currency === "string" ? b.currency : undefined,
    customerName: str(b.customerName),
    customerMobile: str(b.customerMobile),
    status: str(b.status) || "confirmed",
    paymentStatus: typeof b.paymentStatus === "string" ? b.paymentStatus : null,
    expiresAt: typeof b.expiresAt === "string" ? b.expiresAt : null,
    paidAt: typeof b.paidAt === "string" ? b.paidAt : null,
    createdAt: str(b.createdAt) || undefined,
  };
}

function normalizeInitiatePayment(raw: unknown): InitiateBookingPayment | null {
  const p = asRecord(raw);
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const paymentSessionId = str(p.paymentSessionId);
  if (!paymentSessionId) return null;
  return {
    orderId: str(p.orderId),
    cashfreeOrderId: str(p.cashfreeOrderId),
    paymentSessionId,
    amount: typeof p.amount === "number" ? p.amount : 0,
    currency: str(p.currency) || "INR",
    expiresAt: str(p.expiresAt),
    mode: str(p.mode) === "production" ? "production" : "sandbox",
  };
}

export async function getPublicBusiness(businessId: string): Promise<PublicBusiness> {
  const data = await api(`public/businesses/${businessId}`);
  return normalizePublicBusiness(asRecord(data).business);
}

export async function listPublicBusinessSlots(
  businessId: string,
  params: { from: string; to: string; resourceId?: string; serviceIds?: string[]; staffId?: string },
): Promise<BusinessSlotsResponse> {
  const qs = new URLSearchParams({ from: params.from, to: params.to });
  if (params.resourceId) qs.set("resourceId", params.resourceId);
  if (params.serviceIds?.length) qs.set("serviceIds", params.serviceIds.join(","));
  if (params.staffId) qs.set("staffId", params.staffId);
  const data = await api(`public/businesses/${businessId}/slots?${qs}`);
  return normalizeSlotsResponse(data);
}

export async function listCustomerBookings(): Promise<CustomerBooking[]> {
  const data = await authedApi("user/bookings");
  const list = asRecord(data).bookings;
  return Array.isArray(list)
    ? list.map(normalizeCustomerBooking).filter((b): b is CustomerBooking => b !== null)
    : [];
}

export type BookingRequest = {
  businessId: string;
  startAt: string;
  resourceId?: string;
  serviceIds?: string[];
  staffId?: string;
};

export async function createCustomerBooking(body: BookingRequest): Promise<CustomerBooking> {
  const data = await postAuthed("user/bookings", body);
  const booking = normalizeCustomerBooking(asRecord(data).booking);
  if (!booking) throw new Error("Booking failed.");
  return booking;
}

export async function initiateCustomerBooking(body: BookingRequest): Promise<InitiateBookingResult> {
  const data = await postAuthed("user/bookings/initiate", body);
  const root = asRecord(data);
  const booking = normalizeCustomerBooking(root.booking);
  const payment = normalizeInitiatePayment(root.payment);
  if (!booking || !payment) throw new Error("Could not start payment.");
  return { booking, payment };
}

export async function getCustomerBookingStatus(bookingId: string): Promise<CustomerBooking> {
  const data = await authedApi(`user/bookings/${encodeURIComponent(bookingId)}`);
  const booking = normalizeCustomerBooking(asRecord(data).booking);
  if (!booking) throw new Error("Booking not found.");
  return booking;
}

export async function cancelCustomerBooking(bookingId: string): Promise<void> {
  await authedApi(`user/bookings/${bookingId}`, { method: "DELETE" });
}

/* ------------------------------------------------------------------ */
/* Events & tournaments                                                */
/* ------------------------------------------------------------------ */

export type EventKind = "tournament" | "event";
export type EventFormat = "individual" | "team";
export type EventStatus = "draft" | "published" | "cancelled" | "completed";

export type RuxEvent = {
  id: string;
  businessId: string;
  businessName: string;
  kind: EventKind;
  title: string;
  description: string;
  tournamentType: string;
  format: EventFormat;
  teamSize: number | null;
  capacity: number | null;
  reservedCount: number;
  confirmedCount: number;
  spotsLeft: number | null;
  entryFee: number;
  currency: string;
  venue: string;
  coverUrl: string | null;
  skillLevel: string;
  ageCategory: string;
  genderCategory: string;
  rules: string;
  startAt: string | null;
  endAt: string | null;
  registrationDeadline: string | null;
  status: EventStatus;
  createdAt?: string;
  updatedAt?: string;
};

export type EventRegistration = {
  id: string;
  eventId: string;
  eventTitle: string;
  businessId: string;
  businessName: string;
  kind: EventKind;
  format: EventFormat;
  teamName: string | null;
  participants: { name: string }[];
  customerName: string;
  customerMobile: string;
  amount: number;
  currency: string;
  status: string;
  paymentStatus?: string | null;
  paymentSessionId?: string | null;
  startAt: string | null;
  venue: string;
  expiresAt?: string | null;
  paidAt?: string | null;
  createdAt?: string;
};

export type EventInput = {
  businessId?: string;
  kind?: EventKind;
  title?: string;
  description?: string;
  tournamentType?: string;
  format?: EventFormat;
  teamSize?: number | null;
  capacity?: number | null;
  entryFee?: number;
  venue?: string;
  skillLevel?: string;
  ageCategory?: string;
  genderCategory?: string;
  rules?: string;
  startAt?: string;
  endAt?: string | null;
  registrationDeadline?: string | null;
};

export type RegisterEventResult = {
  registration: EventRegistration;
  payment: InitiateBookingPayment | null;
};

function normalizeEvent(raw: unknown): RuxEvent | null {
  const e = asRecord(raw);
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const numOrNull = (v: unknown) => (typeof v === "number" ? v : null);
  const id = str(e.id) || str(e._id);
  if (!id) return null;
  return {
    id,
    businessId: str(e.businessId),
    businessName: str(e.businessName),
    kind: e.kind === "event" ? "event" : "tournament",
    title: str(e.title),
    description: str(e.description),
    tournamentType: str(e.tournamentType),
    format: e.format === "team" ? "team" : "individual",
    teamSize: numOrNull(e.teamSize),
    capacity: numOrNull(e.capacity),
    reservedCount: typeof e.reservedCount === "number" ? e.reservedCount : 0,
    confirmedCount: typeof e.confirmedCount === "number" ? e.confirmedCount : 0,
    spotsLeft: numOrNull(e.spotsLeft),
    entryFee: typeof e.entryFee === "number" ? e.entryFee : 0,
    currency: str(e.currency) || "INR",
    venue: str(e.venue),
    coverUrl: typeof e.coverUrl === "string" ? e.coverUrl : null,
    skillLevel: str(e.skillLevel),
    ageCategory: str(e.ageCategory),
    genderCategory: str(e.genderCategory),
    rules: str(e.rules),
    startAt: typeof e.startAt === "string" ? e.startAt : null,
    endAt: typeof e.endAt === "string" ? e.endAt : null,
    registrationDeadline: typeof e.registrationDeadline === "string" ? e.registrationDeadline : null,
    status: (["draft", "published", "cancelled", "completed"] as const).includes(
      e.status as EventStatus,
    )
      ? (e.status as EventStatus)
      : "draft",
    createdAt: str(e.createdAt) || undefined,
    updatedAt: str(e.updatedAt) || undefined,
  };
}

function normalizeRegistration(raw: unknown): EventRegistration | null {
  const r = asRecord(raw);
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const id = str(r.id) || str(r._id);
  if (!id) return null;
  const participants = Array.isArray(r.participants)
    ? r.participants
        .map((p) => ({ name: str(asRecord(p).name) }))
        .filter((p) => p.name)
    : [];
  return {
    id,
    eventId: str(r.eventId),
    eventTitle: str(r.eventTitle),
    businessId: str(r.businessId),
    businessName: str(r.businessName),
    kind: r.kind === "event" ? "event" : "tournament",
    format: r.format === "team" ? "team" : "individual",
    teamName: typeof r.teamName === "string" ? r.teamName : null,
    participants,
    customerName: str(r.customerName),
    customerMobile: str(r.customerMobile),
    amount: typeof r.amount === "number" ? r.amount : 0,
    currency: str(r.currency) || "INR",
    status: str(r.status) || "confirmed",
    paymentStatus: typeof r.paymentStatus === "string" ? r.paymentStatus : null,
    paymentSessionId: typeof r.paymentSessionId === "string" ? r.paymentSessionId : null,
    startAt: typeof r.startAt === "string" ? r.startAt : null,
    venue: str(r.venue),
    expiresAt: typeof r.expiresAt === "string" ? r.expiresAt : null,
    paidAt: typeof r.paidAt === "string" ? r.paidAt : null,
    createdAt: str(r.createdAt) || undefined,
  };
}

// ── Public discovery ──
export async function listPublicEvents(): Promise<RuxEvent[]> {
  const data = await api("public/events");
  const list = asRecord(data).events;
  return Array.isArray(list)
    ? list.map(normalizeEvent).filter((e): e is RuxEvent => e !== null)
    : [];
}

export async function getPublicEvent(eventId: string): Promise<RuxEvent> {
  const data = await api(`public/events/${encodeURIComponent(eventId)}`);
  const event = normalizeEvent(asRecord(data).event);
  if (!event) throw new Error("Event not found.");
  return event;
}

// ── Customer registration ──
export async function registerForEvent(
  eventId: string,
  body: { teamName?: string; participants?: { name: string }[] },
): Promise<RegisterEventResult> {
  const data = await postAuthed(`user/events/${encodeURIComponent(eventId)}/register`, body);
  const root = asRecord(data);
  const registration = normalizeRegistration(root.registration);
  if (!registration) throw new Error("Could not register.");
  const payment = root.payment ? normalizeInitiatePayment(root.payment) : null;
  return { registration, payment };
}

export async function listMyEventRegistrations(): Promise<EventRegistration[]> {
  const data = await authedApi("user/event-registrations");
  const list = asRecord(data).registrations;
  return Array.isArray(list)
    ? list.map(normalizeRegistration).filter((r): r is EventRegistration => r !== null)
    : [];
}

export async function getEventRegistrationStatus(id: string): Promise<EventRegistration> {
  const data = await authedApi(`user/event-registrations/${encodeURIComponent(id)}`);
  const reg = normalizeRegistration(asRecord(data).registration);
  if (!reg) throw new Error("Registration not found.");
  return reg;
}

// ── Vendor authoring ──
export async function listVendorEvents(): Promise<RuxEvent[]> {
  try {
    const data = await authedApi("vendor/events");
    const list = asRecord(data).events;
    return Array.isArray(list)
      ? list.map(normalizeEvent).filter((e): e is RuxEvent => e !== null)
      : [];
  } catch (err) {
    return mapKycError(err);
  }
}

export async function getVendorEvent(
  eventId: string,
): Promise<{ event: RuxEvent; registrations: EventRegistration[] }> {
  try {
    const data = await authedApi(`vendor/events/${encodeURIComponent(eventId)}`);
    const root = asRecord(data);
    const event = normalizeEvent(root.event);
    if (!event) throw new Error("Event not found.");
    const registrations = Array.isArray(root.registrations)
      ? root.registrations
          .map(normalizeRegistration)
          .filter((r): r is EventRegistration => r !== null)
      : [];
    return { event, registrations };
  } catch (err) {
    return mapKycError(err);
  }
}

export async function createVendorEvent(body: EventInput): Promise<RuxEvent> {
  try {
    const data = await postAuthed("vendor/events", body);
    const event = normalizeEvent(asRecord(data).event);
    if (!event) throw new Error("Could not create event.");
    return event;
  } catch (err) {
    return mapKycError(err);
  }
}

export async function updateVendorEvent(eventId: string, body: EventInput): Promise<RuxEvent> {
  try {
    const data = await postAuthedMethod(
      `vendor/events/${encodeURIComponent(eventId)}`,
      "PATCH",
      body,
    );
    const event = normalizeEvent(asRecord(data).event);
    if (!event) throw new Error("Could not update event.");
    return event;
  } catch (err) {
    return mapKycError(err);
  }
}

export async function setVendorEventStatus(
  eventId: string,
  action: "publish" | "unpublish" | "cancel",
): Promise<RuxEvent> {
  try {
    const data = await postAuthed(`vendor/events/${encodeURIComponent(eventId)}/${action}`, {});
    const event = normalizeEvent(asRecord(data).event);
    if (!event) throw new Error("Could not update event.");
    return event;
  } catch (err) {
    return mapKycError(err);
  }
}

export async function deleteVendorEvent(eventId: string): Promise<void> {
  try {
    await authedApi(`vendor/events/${encodeURIComponent(eventId)}`, { method: "DELETE" });
  } catch (err) {
    return mapKycError(err);
  }
}

// Vendor-facing bookings (paid orders) reuse the same shape — they carry the
// customer's name/mobile so vendors know who booked each slot.
export type VendorBooking = CustomerBooking;

export async function listVendorBookings(params?: {
  businessId?: string;
}): Promise<VendorBooking[]> {
  const qs = new URLSearchParams();
  if (params?.businessId) qs.set("businessId", params.businessId);
  const suffix = qs.toString() ? `?${qs}` : "";
  try {
    const data = await authedApi(`vendor/bookings${suffix}`);
    const list = asRecord(data).bookings;
    return Array.isArray(list)
      ? list.map(normalizeCustomerBooking).filter((b): b is VendorBooking => b !== null)
      : [];
  } catch (err) {
    return mapKycError(err);
  }
}

/* ------------------------------------------------------------------ */
/* Business catalog (DB-backed, shared by web + app)                   */
/* ------------------------------------------------------------------ */

export type CatalogBusinessType = {
  id: string;
  categoryId: string;
  label: string;
  description: string;
  examples: string;
  namePlaceholder: string;
  detailHint: string;
  module: BusinessModule;
  sortOrder?: number;
};

export type CatalogBusinessCategory = {
  id: string;
  label: string;
  description: string;
  icon: string;
  sortOrder?: number;
  types: CatalogBusinessType[];
};

export type BusinessCatalog = {
  categories: CatalogBusinessCategory[];
  modules: Record<string, string>;
};

function normalizeCatalogType(raw: unknown): CatalogBusinessType | null {
  const t = asRecord(raw);
  const id = typeof t.id === "string" ? t.id : "";
  if (!id) return null;
  const module = BUSINESS_MODULES.includes(t.module as BusinessModule)
    ? (t.module as BusinessModule)
    : "commerce";
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    id,
    categoryId: str(t.categoryId),
    label: str(t.label),
    description: str(t.description),
    examples: str(t.examples),
    namePlaceholder: str(t.namePlaceholder),
    detailHint: str(t.detailHint),
    module,
    sortOrder: typeof t.sortOrder === "number" ? t.sortOrder : undefined,
  };
}

function normalizeCatalogCategory(raw: unknown): CatalogBusinessCategory | null {
  const c = asRecord(raw);
  const id = typeof c.id === "string" ? c.id : "";
  if (!id) return null;
  const typesRaw = c.types;
  const types = Array.isArray(typesRaw)
    ? typesRaw.map(normalizeCatalogType).filter((t): t is CatalogBusinessType => t !== null)
    : [];
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    id,
    label: str(c.label),
    description: str(c.description),
    icon: str(c.icon) || "🏪",
    sortOrder: typeof c.sortOrder === "number" ? c.sortOrder : undefined,
    types,
  };
}

export async function getBusinessCatalog(): Promise<BusinessCatalog> {
  const data = await api("catalog/business");
  const payload = asRecord(data);
  const categoriesRaw = payload.categories;
  const categories = Array.isArray(categoriesRaw)
    ? categoriesRaw
        .map(normalizeCatalogCategory)
        .filter((c): c is CatalogBusinessCategory => c !== null)
    : [];
  const modulesRaw = asRecord(payload.modules);
  const modules: Record<string, string> = {};
  for (const [key, value] of Object.entries(modulesRaw)) {
    if (typeof value === "string") modules[key] = value;
  }
  return { categories, modules };
}


/* ------------------------------------------------------------------ */
/* Admin catalog management (categories + types)                       */
/* ------------------------------------------------------------------ */

export type AdminCatalogCategory = CatalogBusinessCategory & { active: boolean };
export type AdminCatalogType = CatalogBusinessType & { active: boolean };

function normalizeAdminCategory(raw: unknown): AdminCatalogCategory | null {
  const base = normalizeCatalogCategory(raw);
  if (!base) return null;
  const c = asRecord(raw);
  return { ...base, active: c.active !== false };
}

function normalizeAdminType(raw: unknown): AdminCatalogType | null {
  const base = normalizeCatalogType(raw);
  if (!base) return null;
  const t = asRecord(raw);
  return { ...base, active: t.active !== false };
}

export async function listAdminCategories(): Promise<AdminCatalogCategory[]> {
  const data = await authedApi("admin/business-categories");
  const list = asRecord(data).categories;
  return Array.isArray(list)
    ? list.map(normalizeAdminCategory).filter((c): c is AdminCatalogCategory => c !== null)
    : [];
}

export async function listAdminTypes(categoryId?: string): Promise<AdminCatalogType[]> {
  const qs = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : "";
  const data = await authedApi(`admin/business-types${qs}`);
  const list = asRecord(data).types;
  return Array.isArray(list)
    ? list.map(normalizeAdminType).filter((t): t is AdminCatalogType => t !== null)
    : [];
}

export type CatalogCategoryInput = {
  id?: string;
  label: string;
  description?: string;
  icon?: string;
  sortOrder?: number;
  active?: boolean;
};

export type CatalogTypeInput = {
  id?: string;
  categoryId: string;
  label: string;
  module: BusinessModule;
  description?: string;
  examples?: string;
  namePlaceholder?: string;
  detailHint?: string;
  sortOrder?: number;
  active?: boolean;
};

export async function createAdminCategory(body: CatalogCategoryInput) {
  return authedApi("admin/business-categories", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateAdminCategory(id: string, body: Partial<CatalogCategoryInput>) {
  return authedApi(`admin/business-categories/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function createAdminType(body: CatalogTypeInput) {
  return authedApi("admin/business-types", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateAdminType(id: string, body: Partial<CatalogTypeInput>) {
  return authedApi(`admin/business-types/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export type AdminUser = {
  _id?: string;
  id?: string;
  name?: string;
  mobile?: string;
  role?: string;
  roles?: string[];
  status?: string;
};

export type AdminVendorKycRow = {
  userId: string;
  name?: string;
  mobile?: string;
  businessName?: string;
  status: KycOverallStatus;
  kyc: VendorKycStatus;
  rejectReason?: string;
};

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

export function asList(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw.map(asRecord);
  const data = asRecord(raw);
  for (const key of ["users", "vendors", "data", "items", "kyc", "results"]) {
    if (Array.isArray(data[key])) return (data[key] as unknown[]).map(asRecord);
  }
  return [];
}

export function recordId(row: Record<string, unknown>) {
  const user = asRecord(row.user);
  const id = row._id ?? row.id ?? row.userId ?? user._id ?? user.id;
  return typeof id === "string" ? id : "";
}

function inferKycOverallStatus(kyc: VendorKycStatus): KycOverallStatus {
  const aadhaar = stepDone(kyc.aadhaar);
  const pan = stepDone(kyc.pan);
  const face = stepDone(kyc.face);

  if (aadhaar && pan && face) {
    if (
      kyc.status === "verified" ||
      kyc.status === "rejected" ||
      kyc.status === "pending_review"
    ) {
      return kyc.status;
    }
    return "pending_review";
  }

  if (aadhaar || pan || face) return "in_progress";
  return "pending";
}

function resolveKycOverallStatus(raw: Record<string, unknown>, kyc: VendorKycStatus): KycOverallStatus {
  const kycObj = asRecord(raw.kyc);
  const candidates = [kycObj.status, raw.kycStatus, raw.kyc_status, kyc.status];

  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      const value = candidate.toLowerCase();
      if (isKycOverallStatus(value)) return value;
    }
  }

  return inferKycOverallStatus(kyc);
}

export function normalizeAdminVendorKycRow(raw: Record<string, unknown>): AdminVendorKycRow {
  const user = asRecord(raw.user);
  const kycObj = asRecord(raw.kyc);
  const kycSource =
    Object.keys(kycObj).length > 0
      ? kycObj
      : {
          status: raw.kycStatus ?? raw.kyc_status,
          aadhaar: raw.aadhaar,
          pan: raw.pan,
          face: raw.face,
          steps: raw.steps,
          rejectReason: raw.rejectReason ?? raw.reason,
        };
  const kyc = normalizeVendorKycStatus(kycSource);
  const status = resolveKycOverallStatus(raw, kyc);

  return {
    userId: recordId(raw) || recordId(user),
    name:
      (typeof raw.name === "string" ? raw.name : undefined) ??
      (typeof user.name === "string" ? user.name : undefined),
    mobile:
      (typeof raw.mobile === "string" ? raw.mobile : undefined) ??
      (typeof user.mobile === "string" ? user.mobile : undefined),
    businessName: typeof raw.businessName === "string" ? raw.businessName : undefined,
    status,
    kyc: { ...kyc, status },
    rejectReason:
      typeof raw.rejectReason === "string"
        ? raw.rejectReason
        : typeof kyc.rejectReason === "string"
          ? kyc.rejectReason
          : typeof kyc.reason === "string"
            ? kyc.reason
            : undefined,
  };
}

export function normalizeAdminUser(raw: Record<string, unknown>): AdminUser {
  return {
    _id: typeof raw._id === "string" ? raw._id : typeof raw.id === "string" ? raw.id : undefined,
    id: typeof raw.id === "string" ? raw.id : typeof raw._id === "string" ? raw._id : undefined,
    name: typeof raw.name === "string" ? raw.name : undefined,
    mobile: typeof raw.mobile === "string" ? raw.mobile : undefined,
    role: typeof raw.role === "string" ? raw.role : undefined,
    roles: Array.isArray(raw.roles) ? (raw.roles as string[]) : undefined,
    status: typeof raw.status === "string" ? raw.status : undefined,
  };
}

export async function listAdminUsers(role?: string) {
  const qs = role ? `?role=${encodeURIComponent(role)}` : "";
  const data = await authedApi(`admin/users${qs}`);
  return asList(data).map(normalizeAdminUser);
}

export async function createAdminUser(body: {
  mobile: string;
  name: string;
  password: string;
  role: "admin" | "employee";
}) {
  return authedApi("admin/users", { method: "POST", body: JSON.stringify(body) });
}

export async function updateAdminUser(userId: string, body: Record<string, unknown>) {
  return authedApi(`admin/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function setAdminUserStatus(userId: string, status: "active" | "disabled") {
  const data = await updateAdminUser(userId, { status });
  return normalizeAdminUser(asRecord(asRecord(data).user));
}

export function filterAdminVendorKyc(
  rows: AdminVendorKycRow[],
  status?: KycOverallStatus | "all",
) {
  if (!status || status === "all") return rows;
  return rows.filter((row) => row.status === status);
}

export async function fetchAllAdminVendorKyc() {
  const data = await authedApi("admin/kyc");
  return asList(data).map(normalizeAdminVendorKycRow).filter((row) => row.userId);
}

export async function listAdminVendorKyc(status?: KycOverallStatus | "all") {
  const rows = await fetchAllAdminVendorKyc();
  return filterAdminVendorKyc(rows, status);
}

export async function getAdminVendorKyc(vendorUserId: string) {
  const data = await authedApi(`admin/kyc/${vendorUserId}`);
  return normalizeAdminVendorKycRow(asRecord(data));
}

export async function reviewAdminVendorKyc(
  vendorUserId: string,
  action: "approve" | "reject",
  reason?: string,
) {
  const body =
    action === "reject"
      ? { action, reason: reason?.trim() || "Rejected by admin" }
      : { action };
  await authedApi(`admin/kyc/${vendorUserId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/* ------------------------------------------------------------------ */
/* Print on demand — catalog, orders, notifications                    */
/* ------------------------------------------------------------------ */

export type PrintRequirementType = "select" | "text" | "textarea" | "file";

export type PrintRequirementField = {
  key: string;
  label: string;
  type: PrintRequirementType;
  required: boolean;
  hint: string;
  placeholder: string;
};

export type PrintPricingModel = "per_unit" | "per_page";

export type PrintCategory = {
  id: string;
  label: string;
  icon: string;
  description: string;
  pricingModel: PrintPricingModel;
  minQuantity: number;
  sizes: string[];
  printTypes: string[];
  materials: string[];
  colorOptions: string[];
  sides: string[];
  bindingOptions: string[];
  requirements: PrintRequirementField[];
};

function strArray(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
}

function normalizePrintRequirement(raw: unknown): PrintRequirementField | null {
  const r = asRecord(raw);
  const key = typeof r.key === "string" ? r.key.trim() : "";
  if (!key || !/^[a-z][a-z0-9_]{0,31}$/.test(key)) return null;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const typeRaw = str(r.type);
  const selectKeys = new Set(["size", "material", "printType", "color"]);
  let type: PrintRequirementType = "text";
  if (typeRaw === "select" || typeRaw === "text" || typeRaw === "textarea" || typeRaw === "file") {
    type = typeRaw;
  } else if (key === "designImage") {
    type = "file";
  } else if (selectKeys.has(key)) {
    type = "select";
  }
  return {
    key,
    label: str(r.label) || key,
    type,
    required: r.required === true,
    hint: str(r.hint),
    placeholder: str(r.placeholder),
  };
}

function normalizePrintCategory(raw: unknown): PrintCategory | null {
  const c = asRecord(raw);
  const id = typeof c.id === "string" ? c.id : "";
  if (!id) return null;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const requirements = Array.isArray(c.requirements)
    ? c.requirements
        .map(normalizePrintRequirement)
        .filter((field): field is PrintRequirementField => field !== null)
    : [];
  return {
    id,
    label: str(c.label),
    icon: str(c.icon) || "🖨️",
    description: str(c.description),
    pricingModel: c.pricingModel === "per_page" ? "per_page" : "per_unit",
    minQuantity: typeof c.minQuantity === "number" ? c.minQuantity : 1,
    sizes: strArray(c.sizes),
    printTypes: strArray(c.printTypes),
    materials: strArray(c.materials),
    colorOptions: strArray(c.colorOptions),
    sides: strArray(c.sides),
    bindingOptions: strArray(c.bindingOptions),
    requirements,
  };
}

export async function getPrintCatalog(): Promise<PrintCategory[]> {
  const data = await api("catalog/print");
  const list = asRecord(data).categories;
  return Array.isArray(list)
    ? list.map(normalizePrintCategory).filter((c): c is PrintCategory => c !== null)
    : [];
}

export type PrintOrderAttributes = {
  printType?: string;
  material?: string;
  color?: string;
  size?: string;
  extras?: Record<string, string>;
};

export type PrintOrderStatus =
  | "open"
  | "accepted"
  | "pending_payment"
  | "confirmed"
  | "in_production"
  | "ready"
  | "completed"
  | "cancelled"
  | "expired";

// A customer's configured selection, recomputed + priced server-side at order time.
export type PrintOrderSelection = {
  quantity?: number;
  copies?: number;
  options?: Record<string, string>;
  sections?: { pages: number; color: "bw" | "color" }[];
  doubleSided?: boolean;
  binding?: string;
  paperSize?: string;
};

export type PrintOrder = {
  id: string;
  customerName: string;
  customerMobile: string;
  categoryId: string;
  categoryLabel: string;
  title: string;
  attributes: PrintOrderAttributes;
  quantity: number | null;
  notes: string;
  city: string;
  pincode: string;
  hasDesign: boolean;
  designImageUrl: string | null;
  designImage?: string;
  status: PrintOrderStatus;
  assignedVendorId: string | null;
  assignedBusinessId: string | null;
  vendorName: string | null;
  businessName: string | null;
  vendorMobile: string | null;
  vendorNote: string;
  quoteAmount: number | null;
  currency: string;
  paymentStatus: string | null;
  acceptedAt: string | null;
  paidAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

function normalizePrintOrder(raw: unknown): PrintOrder | null {
  const o = asRecord(raw);
  const id = typeof o.id === "string" ? o.id : "";
  if (!id) return null;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const attrs = asRecord(o.attributes);
  const rawExtras = asRecord(attrs.extras);
  const extras: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawExtras)) {
    if (typeof v === "string" && v.trim()) extras[k] = v.trim();
  }
  return {
    id,
    customerName: str(o.customerName),
    customerMobile: str(o.customerMobile),
    categoryId: str(o.categoryId),
    categoryLabel: str(o.categoryLabel),
    title: str(o.title),
    attributes: {
      printType: str(attrs.printType) || undefined,
      material: str(attrs.material) || undefined,
      color: str(attrs.color) || undefined,
      size: str(attrs.size) || undefined,
      ...(Object.keys(extras).length ? { extras } : {}),
    },
    quantity: typeof o.quantity === "number" ? o.quantity : null,
    notes: str(o.notes),
    city: str(o.city),
    pincode: str(o.pincode),
    hasDesign: o.hasDesign === true,
    designImageUrl: typeof o.designImageUrl === "string" ? o.designImageUrl : null,
    designImage: typeof o.designImage === "string" ? o.designImage : undefined,
    status: (str(o.status) || "open") as PrintOrderStatus,
    assignedVendorId: typeof o.assignedVendorId === "string" ? o.assignedVendorId : null,
    assignedBusinessId: typeof o.assignedBusinessId === "string" ? o.assignedBusinessId : null,
    vendorName: typeof o.vendorName === "string" ? o.vendorName : null,
    businessName: typeof o.businessName === "string" ? o.businessName : null,
    vendorMobile: typeof o.vendorMobile === "string" ? o.vendorMobile : null,
    vendorNote: str(o.vendorNote),
    quoteAmount: typeof o.quoteAmount === "number" ? o.quoteAmount : null,
    currency: str(o.currency) || "INR",
    paymentStatus: typeof o.paymentStatus === "string" ? o.paymentStatus : null,
    acceptedAt: typeof o.acceptedAt === "string" ? o.acceptedAt : null,
    paidAt: typeof o.paidAt === "string" ? o.paidAt : null,
    createdAt: typeof o.createdAt === "string" ? o.createdAt : null,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : null,
  };
}

// ── Direct-pricing: available shops for a category ──
export type PrintShop = {
  businessId: string;
  vendorId: string;
  name: string;
  thumbnailUrl: string;
  city: string;
  acceptingOrders: boolean;
  pricingModel: PrintPricingModel;
  turnaroundDays: number;
  minQuantity: number;
  fromPrice: number;
  pricing: CategoryPricing;
};

function normalizePrintShop(raw: unknown): PrintShop | null {
  const s = asRecord(raw);
  const businessId = typeof s.businessId === "string" ? s.businessId : "";
  if (!businessId) return null;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return {
    businessId,
    vendorId: str(s.vendorId),
    name: str(s.name) || "Print shop",
    thumbnailUrl: str(s.thumbnailUrl),
    city: str(s.city),
    acceptingOrders: s.acceptingOrders !== false,
    pricingModel: s.pricingModel === "per_page" ? "per_page" : "per_unit",
    turnaroundDays: num(s.turnaroundDays),
    minQuantity: Math.max(1, num(s.minQuantity) || 1),
    fromPrice: num(s.fromPrice),
    pricing: normalizeCategoryPricing(s.pricing),
  };
}

export async function listPrintShops(categoryId: string, city: string): Promise<PrintShop[]> {
  const qs = new URLSearchParams({ category: categoryId, city: city.trim() }).toString();
  const data = await authedApi(`pod/shops?${qs}`);
  const list = asRecord(data).shops;
  return Array.isArray(list)
    ? list.map(normalizePrintShop).filter((s): s is PrintShop => s !== null)
    : [];
}

// Direct fixed-price order: customer picks a specific shop + configuration.
export type CreatePrintOrderInput = {
  businessId: string;
  categoryId: string;
  selection: PrintOrderSelection;
  city: string;
  pincode?: string;
  notes?: string;
  attributes?: PrintOrderAttributes;
  designImage?: string;
};

// ── Customer ──
export async function createPrintOrder(body: CreatePrintOrderInput): Promise<PrintOrder> {
  const data = await postAuthed("pod/orders", body);
  const order = normalizePrintOrder(asRecord(data).order);
  if (!order) throw new Error("Could not place order.");
  return order;
}

export async function listMyPrintOrders(): Promise<PrintOrder[]> {
  const data = await authedApi("pod/orders");
  const list = asRecord(data).orders;
  return Array.isArray(list)
    ? list.map(normalizePrintOrder).filter((o): o is PrintOrder => o !== null)
    : [];
}

export async function getPrintOrder(id: string): Promise<PrintOrder> {
  const data = await authedApi(`pod/orders/${encodeURIComponent(id)}`);
  const order = normalizePrintOrder(asRecord(data).order);
  if (!order) throw new Error("Order not found.");
  return order;
}

export async function payPrintOrder(
  id: string,
): Promise<{ order: PrintOrder; payment: InitiateBookingPayment }> {
  const data = await postAuthed(`pod/orders/${encodeURIComponent(id)}/pay`, {});
  const root = asRecord(data);
  const order = normalizePrintOrder(root.order);
  const payment = normalizeInitiatePayment(root.payment);
  if (!order || !payment) throw new Error("Could not start payment.");
  return { order, payment };
}

export async function cancelPrintOrder(id: string): Promise<void> {
  await postAuthed(`pod/orders/${encodeURIComponent(id)}/cancel`, {});
}

// ── Vendor ──
export type VendorPrintOrders = {
  assigned: PrintOrder[];
  eligible: { hasPrintBusiness: boolean };
};

export async function listVendorPrintOrders(): Promise<VendorPrintOrders> {
  try {
    const data = await authedApi("pod/vendor/orders");
    const root = asRecord(data);
    const assigned = Array.isArray(root.assigned)
      ? root.assigned.map(normalizePrintOrder).filter((o): o is PrintOrder => o !== null)
      : [];
    const eligible = asRecord(root.eligible);
    return {
      assigned,
      eligible: { hasPrintBusiness: eligible.hasPrintBusiness === true },
    };
  } catch (err) {
    return mapKycError(err);
  }
}

export async function getVendorPrintOrder(id: string): Promise<PrintOrder> {
  const data = await authedApi(`pod/vendor/orders/${encodeURIComponent(id)}`);
  const order = normalizePrintOrder(asRecord(data).order);
  if (!order) throw new Error("Order not found.");
  return order;
}

export async function updatePrintOrderStatus(
  id: string,
  status: PrintOrderStatus,
): Promise<PrintOrder> {
  const data = await postAuthed(`pod/vendor/orders/${encodeURIComponent(id)}/status`, { status });
  const order = normalizePrintOrder(asRecord(data).order);
  if (!order) throw new Error("Could not update order.");
  return order;
}

// ── Notifications (shared by customers + vendors) ──
export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read: boolean;
  createdAt: string | null;
};

function normalizeNotification(raw: unknown): AppNotification | null {
  const n = asRecord(raw);
  const id = typeof n.id === "string" ? n.id : "";
  if (!id) return null;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    id,
    type: str(n.type) || "info",
    title: str(n.title),
    body: str(n.body),
    data: asRecord(n.data),
    read: n.read === true,
    createdAt: typeof n.createdAt === "string" ? n.createdAt : null,
  };
}

export type NotificationsResult = {
  notifications: AppNotification[];
  unreadCount: number;
};

export async function listNotifications(): Promise<NotificationsResult> {
  const data = await authedApi("notifications");
  const root = asRecord(data);
  const list = Array.isArray(root.notifications)
    ? root.notifications.map(normalizeNotification).filter((n): n is AppNotification => n !== null)
    : [];
  return {
    notifications: list,
    unreadCount: typeof root.unreadCount === "number" ? root.unreadCount : 0,
  };
}

export async function markNotificationRead(id: string): Promise<void> {
  await postAuthed(`notifications/${encodeURIComponent(id)}/read`, {});
}

export async function markAllNotificationsRead(): Promise<void> {
  await postAuthed("notifications/read-all", {});
}
