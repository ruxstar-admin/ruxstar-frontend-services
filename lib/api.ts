type AuthUser = {
  role?: string;
  roles?: string[];
};

export type KycOverallStatus =
  | "pending"
  | "in_progress"
  | "pending_review"
  | "verified"
  | "rejected";

export type KycStepState = "pending" | "in_progress" | "verified" | "failed";

export type VendorKycStatus = {
  status: KycOverallStatus;
  aadhaar?: { status?: KycStepState };
  pan?: { status?: KycStepState };
  face?: { status?: KycStepState };
  rejectReason?: string;
  reason?: string;
};

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`/api/${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 409) {
      throw new Error("Oops! That number's already on Ruxstar — log in instead?");
    }
    if (res.status === 404) {
      throw new Error("No account with that number — sign up first?");
    }
    throw new Error(data.message ?? data.error ?? `Request failed (${res.status})`);
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
  if (user?.role) return user.role;
  const roles = user?.roles?.map((r) => r.toLowerCase()) ?? [];
  if (roles.includes("vendor")) return "vendor";
  if (roles.includes("delivery")) return "delivery";
  if (roles.includes("admin")) return "admin";
  if (roles.includes("employee")) return "employee";
  if (roles.length) return roles[0];
  return fallback;
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

function stepDone(step?: { status?: KycStepState }) {
  return step?.status === "verified";
}

export function nextKycStep(kyc: VendorKycStatus | null | undefined) {
  if (!kyc) return "aadhaar" as const;
  if (kyc.status === "verified") return "done" as const;
  if (kyc.status === "pending_review") return "review" as const;
  if (kyc.status === "rejected") return "rejected" as const;
  if (!stepDone(kyc.aadhaar)) return "aadhaar" as const;
  if (!stepDone(kyc.pan)) return "pan" as const;
  if (!stepDone(kyc.face)) return "face" as const;
  return "review" as const;
}

export function vendorDestination(kyc: VendorKycStatus | null | undefined) {
  if (kyc?.status === "verified") return "/business";
  return "/business/kyc";
}

export function getVendorKycStatus() {
  return authedApi("vendor/kyc/status") as Promise<VendorKycStatus>;
}

export function startAadhaarKyc(redirectUrl: string) {
  return authedApi("vendor/kyc/aadhaar/start", {
    method: "POST",
    body: JSON.stringify({ redirectUrl, userFlow: "signin" }),
  }) as Promise<{ url?: string }>;
}

export function syncAadhaarKyc() {
  return authedApi("vendor/kyc/aadhaar/sync") as Promise<VendorKycStatus>;
}

export function verifyPanKyc(pan: string) {
  return authedApi("vendor/kyc/pan", {
    method: "POST",
    body: JSON.stringify({ pan: pan.toUpperCase() }),
  }) as Promise<VendorKycStatus>;
}

export function verifyFaceKyc(image: string) {
  return authedApi("vendor/kyc/face", {
    method: "POST",
    body: JSON.stringify({ image }),
  }) as Promise<VendorKycStatus>;
}

export async function resolvePostAuthPath(user: AuthUser | null | undefined, fallback = "customer") {
  const role = getUserRole(user, fallback);
  if (role !== "vendor") return homeForRole(role);

  try {
    const kyc = await getVendorKycStatus();
    return vendorDestination(kyc);
  } catch {
    return "/business/kyc";
  }
}
