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

export function homeForRole(role: string) {
  if (role === "vendor") return "/business";
  if (role === "delivery") return "/delivery";
  return "/customer";
}
