type AuthUser = {
  role?: string;
  roles?: string[];
  name?: string;
  mobile?: string;
};

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
  const status =
    typeof statusRaw === "string" ? (statusRaw.toLowerCase() as KycOverallStatus) : "pending";

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
  const res = await fetch(`/api/${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 409) {
      throw new Error("Oops! That number's already on Ruxstar — log in instead?");
    }
    if (res.status === 404) {
      throw new Error("No account with that number — sign up first?");
    }
    const detail =
      (typeof data.message === "string" && data.message) ||
      (typeof data.error === "string" && data.error) ||
      (Array.isArray(data.errors) && data.errors[0]) ||
      (data.errors &&
        typeof data.errors === "object" &&
        Object.values(data.errors as Record<string, unknown>).find((v) => typeof v === "string"));
    throw new Error((detail as string | undefined) ?? `Request failed (${res.status})`);
  }

  return data;
}

async function authedApi(path: string, init?: RequestInit) {
  const token = getToken();
  if (!token) throw new Error("Please log in to continue.");

  return api(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
}

export function postAuth(path: string, body: unknown) {
  return api(`auth/${path}`, { method: "POST", body: JSON.stringify(body) });
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

export function vendorDestination(kyc: VendorKycStatus | null | undefined) {
  if (kyc?.status === "verified") return "/business";
  return "/business/kyc";
}

export async function getVendorKycStatus() {
  const data = await authedApi("vendor/kyc/status");
  return normalizeVendorKycStatus(data);
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
  await authedApi("vendor/kyc/pan", {
    method: "POST",
    body: JSON.stringify({ pan: pan.toUpperCase() }),
  });
  return getVendorKycStatus();
}

export async function verifyFaceKyc(image: string) {
  await authedApi("vendor/kyc/face", {
    method: "POST",
    body: JSON.stringify({ image }),
  });
  return getVendorKycStatus();
}

export function isAadhaarVerified(kyc: VendorKycStatus | null | undefined) {
  return stepDone(kyc?.aadhaar);
}

export async function resolvePostAuthPath(user: AuthUser | null | undefined, fallback = "customer") {
  const role = getUserRole(user, fallback);
  if (role === "admin" || role === "employee") return "/admin";
  if (role !== "vendor") return homeForRole(role);

  try {
    const kyc = await getVendorKycStatus();
    return vendorDestination(kyc);
  } catch {
    return "/business/kyc";
  }
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
