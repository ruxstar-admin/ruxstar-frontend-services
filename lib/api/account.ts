import { ApiError, api, unwrap, type ApiErrorCode } from "./client";

export type Purpose = "signup" | "reset";
export type User = Awaited<ReturnType<typeof getMe>>;
export type DeviceSession = Awaited<ReturnType<typeof listSessions>>[number];

export const requestCode = async (phone: string, purpose: Purpose) =>
  (await unwrap(api.POST("/v1/account/otp", { body: { phone, purpose } }))).data;

export const verifyCode = async (phone: string, purpose: Purpose, code: string) =>
  (await unwrap(api.POST("/v1/account/otp/verify", { body: { phone, purpose, code } }))).data;

export const signUp = async (body: { verificationToken: string; name: string; password: string }) =>
  (await unwrap(api.POST("/v1/account/signup", { body: { ...body, acceptTerms: true } }))).data.user;

export const signIn = async (phone: string, password: string) =>
  (await unwrap(api.POST("/v1/account/login", { body: { phone, password } }))).data.user;

export const resetPassword = async (verificationToken: string, password: string) =>
  unwrap(api.POST("/v1/account/password/reset", { body: { verificationToken, password } }));

export const signOut = async () => unwrap(api.POST("/v1/account/logout", { body: {} }));

let refreshing: Promise<boolean> | null = null;

/** One refresh at a time, shared by every call that saw a 401. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= unwrap(api.POST("/v1/account/refresh", { body: {} }))
    .then(() => true)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** Runs a signed-in call, refreshing the access cookie once if it has expired. */
export async function signedIn<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) throw err;
    if (!(await refreshSession())) throw err;
    return call();
  }
}

export const getMe = async () => (await signedIn(() => unwrap(api.GET("/v1/account/me")))).data;

export const updateMe = async (body: { name?: string; username?: string; city?: string | null }) =>
  (await signedIn(() => unwrap(api.PATCH("/v1/account/me", { body })))).data;

export const listSessions = async () => (await signedIn(() => unwrap(api.GET("/v1/account/sessions")))).data;

export const endSession = async (id: string) =>
  signedIn(() => unwrap(api.DELETE("/v1/account/sessions/{id}", { params: { path: { id } } })));

/** Only same-site paths, so `?next=` cannot send people to another site. */
export function nextPath(fallback = "/account"): string {
  if (typeof window === "undefined") return fallback;
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}

/** Message for a form, plus the field it belongs to when the API names one. */
export interface FormError {
  message: string;
  field?: string;
  code?: ApiErrorCode;
}

export function formError(err: unknown): FormError {
  if (!(err instanceof ApiError)) return { message: "Something went wrong. Try again." };
  const { code } = err;
  const detail = err.details[0];
  const field = detail?.path?.replace(/^body\//, "");
  if (code === "VALIDATION_FAILED" && detail) return { message: detail.message, field, code };
  if (code === "OTP_INVALID" && detail) return { message: `${err.message} ${detail.message}`, field: "code", code };
  if ((code === "OTP_LIMIT" || code === "RATE_LIMITED" || code === "ACCOUNT_LOCKED") && detail) {
    return { message: `${err.message} ${detail.message}`, code };
  }
  return { message: err.message, field, code };
}
