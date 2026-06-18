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
      throw new Error("Oops! That number's already on Ruxstar — log in instead?");
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
  | "creator";

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

export type BusinessSetup = {
  photos: BusinessPhoto[];
  weeklyHours: WeeklyHours;
  slotMinutes: number;
  pricePerSlot: number;
  resources: BusinessResource[];
  bookingMode?: "slots" | "fullDay";
  maxGuests?: number | null;
  venueRules?: string;
};

const BUSINESS_MODULES: BusinessModule[] = [
  "events",
  "appointments",
  "services",
  "commerce",
  "creator",
];

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
  bookingMode?: "slots" | "fullDay";
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

  const bookingMode = s.bookingMode === "fullDay" ? "fullDay" : "slots";
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
    bookingMode,
    maxGuests,
    venueRules: typeof s.venueRules === "string" ? s.venueRules : "",
  };
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
  bookingMode?: "slots" | "fullDay";
  maxGuests?: number | null;
  venueRules?: string;
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

/* ------------------------------------------------------------------ */
/* Business slots (generated from setup + vendor block/unblock)        */
/* ------------------------------------------------------------------ */

export type SlotStatus = "available" | "blocked" | "booked" | "unavailable";

export type BusinessSlot = {
  id: string;
  resourceId: string;
  resourceName: string;
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
  bookingMode?: "slots" | "fullDay";
  resources: BusinessResource[];
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
    bookingMode: data.bookingMode === "fullDay" ? "fullDay" : "slots",
    resources: Array.isArray(resourcesRaw)
      ? resourcesRaw.map(normalizeBusinessResource).filter((r): r is BusinessResource => r !== null)
      : [],
    slots: Array.isArray(slotsRaw)
      ? slotsRaw.map(normalizeSlot).filter((s): s is BusinessSlot => s !== null)
      : [],
  };
}

export async function listBusinessSlots(
  businessId: string,
  params: { from: string; to: string; resourceId?: string },
): Promise<BusinessSlotsResponse> {
  try {
    const qs = new URLSearchParams({ from: params.from, to: params.to });
    if (params.resourceId) qs.set("resourceId", params.resourceId);
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
    bookingMode?: "slots" | "fullDay";
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
  bookingMode: "slots" | "fullDay";
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
    bookingMode: b.bookingMode === "fullDay" ? "fullDay" : "slots",
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
  startAt: string;
  endAt: string;
  pricePerSlot: number;
  customerName: string;
  customerMobile: string;
  status: string;
  createdAt?: string;
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
    startAt: str(b.startAt),
    endAt: str(b.endAt),
    pricePerSlot: typeof b.pricePerSlot === "number" ? b.pricePerSlot : 0,
    customerName: str(b.customerName),
    customerMobile: str(b.customerMobile),
    status: str(b.status) || "confirmed",
    createdAt: str(b.createdAt) || undefined,
  };
}

export async function getPublicBusiness(businessId: string): Promise<PublicBusiness> {
  const data = await api(`public/businesses/${businessId}`);
  return normalizePublicBusiness(asRecord(data).business);
}

export async function listPublicBusinessSlots(
  businessId: string,
  params: { from: string; to: string; resourceId?: string },
): Promise<BusinessSlotsResponse> {
  const qs = new URLSearchParams({ from: params.from, to: params.to });
  if (params.resourceId) qs.set("resourceId", params.resourceId);
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

export async function createCustomerBooking(body: {
  businessId: string;
  resourceId: string;
  startAt: string;
}): Promise<CustomerBooking> {
  const data = await postAuthed("user/bookings", body);
  const booking = normalizeCustomerBooking(asRecord(data).booking);
  if (!booking) throw new Error("Booking failed.");
  return booking;
}

export async function cancelCustomerBooking(bookingId: string): Promise<void> {
  await authedApi(`user/bookings/${bookingId}`, { method: "DELETE" });
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
