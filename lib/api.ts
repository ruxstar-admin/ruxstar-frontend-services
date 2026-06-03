type AuthUser = {
  role?: string;
  roles?: string[];
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

export function postAuth(path: string, body: unknown) {
  return api(`auth/${path}`, { method: "POST", body: JSON.stringify(body) });
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
