import { API_URL, ApiError, api, unwrap, type ApiErrorCode } from "./client";
import type { paths } from "./schema";

export type Purpose = "signup" | "reset" | "login";
export type User = Awaited<ReturnType<typeof getMe>>;
export type Gender = NonNullable<User["gender"]>;
export type DeviceSession = Awaited<ReturnType<typeof listSessions>>[number];
export type PublicProfile = paths["/v1/account/profiles/{ref}"]["get"]["responses"][200]["content"]["application/json"]["data"];
type SignupBody = paths["/v1/account/signup"]["post"]["requestBody"]["content"]["application/json"];
type MePatch = paths["/v1/account/me"]["patch"]["requestBody"]["content"]["application/json"];
type PhotoResult = paths["/v1/account/me/photo"]["put"]["responses"][200]["content"]["application/json"];

export const requestCode = async (phone: string, purpose: Purpose) =>
  (await unwrap(api.POST("/v1/account/otp", { body: { phone, purpose } }))).data;

export const verifyCode = async (phone: string, purpose: Purpose, code: string) =>
  (await unwrap(api.POST("/v1/account/otp/verify", { body: { phone, purpose, code } }))).data;

export const signUp = async (body: Omit<SignupBody, "acceptTerms">) =>
  (await unwrap(api.POST("/v1/account/signup", { body: { ...body, acceptTerms: true } }))).data.user;

export const signIn = async (phone: string, password: string) =>
  (await unwrap(api.POST("/v1/account/login", { body: { phone, password } }))).data.user;

/** The code comes from `requestCode(phone, "login")`. */
export const signInWithCode = async (phone: string, code: string) =>
  (await unwrap(api.POST("/v1/account/login/code", { body: { phone, code } }))).data.user;

/** Before signup: whether a handle is free, and free ones made from the name. */
export const suggestUsernames = async (name: string, check?: string) =>
  (await unwrap(api.GET("/v1/account/usernames", { params: { query: { name, ...(check ? { check } : {}) } } }))).data;

export const resetPassword = async (verificationToken: string, password: string) =>
  unwrap(api.POST("/v1/account/password/reset", { body: { verificationToken, password } }));

export const signOut = async () => unwrap(api.POST("/v1/account/logout", { body: {} }));

let refreshing: Promise<boolean> | null = null;

/** One refresh at a time, shared by every call that saw a 401. False only when the session is really over. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= unwrap(api.POST("/v1/account/refresh", { body: {} }))
    .then(() => true)
    .catch((err: unknown) => {
      if (err instanceof ApiError && err.status === 401) return false;
      throw err;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** An ended session. A wrong password is also a 401, but with its own code. */
export const isSignedOut = (err: unknown) => err instanceof ApiError && err.code === "UNAUTHENTICATED";

/** Runs a signed-in call, refreshing the access cookie once if it has expired. */
export async function signedIn<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (err) {
    if (!isSignedOut(err)) throw err;
    if (!(await refreshSession())) throw err;
    return call();
  }
}

export const getMe = async () => (await signedIn(() => unwrap(api.GET("/v1/account/me")))).data;

export const updateMe = async (body: MePatch) => (await signedIn(() => unwrap(api.PATCH("/v1/account/me", { body })))).data;

/** The spec has no body for this route (it is the raw image), so it skips the typed client. */
async function putPhoto(photo: Blob) {
  const response = await fetch(`${API_URL}/v1/account/me/photo`, {
    method: "PUT",
    credentials: "include",
    headers: { "X-Client": "web", "Content-Type": photo.type },
    body: photo,
  });
  const parsed: unknown = await response.json().catch(() => undefined);
  return response.ok ? { data: parsed as PhotoResult, response } : { error: parsed, response };
}

export const setPhoto = async (photo: Blob) => (await signedIn(() => unwrap(putPhoto(photo)))).data;

export const removePhoto = async () => (await signedIn(() => unwrap(api.DELETE("/v1/account/me/photo")))).data;

export const sendEmailCode = async () => (await signedIn(() => unwrap(api.POST("/v1/account/email/code")))).data;

export const verifyEmail = async (code: string) =>
  (await signedIn(() => unwrap(api.POST("/v1/account/email/verify", { body: { code } })))).data;

/** Signs out every other device; this one stays signed in. */
export const changePassword = async (currentPassword: string, newPassword: string) =>
  signedIn(() => unwrap(api.POST("/v1/account/password", { body: { currentPassword, newPassword } })));

export const deleteAccount = async (password: string) =>
  signedIn(() => unwrap(api.DELETE("/v1/account/me", { body: { password } })));

export const checkUsername = async (check?: string) =>
  (await signedIn(() => unwrap(api.GET("/v1/account/usernames", { params: { query: check ? { check } : {} } })))).data;

export const cityAt = async (lat: number, lng: number) =>
  (await signedIn(() => unwrap(api.GET("/v1/account/city", { params: { query: { lat, lng } } })))).data;

export const listSessions = async () => (await signedIn(() => unwrap(api.GET("/v1/account/sessions")))).data;

export const endSession = async (id: string) =>
  signedIn(() => unwrap(api.DELETE("/v1/account/sessions/{id}", { params: { path: { id } } })));

/** Only same-site paths, so `?next=` cannot send people to another site. */
export function nextPath(fallback = "/account"): string {
  if (typeof window === "undefined") return fallback;
  const next = new URLSearchParams(window.location.search).get("next");
  if (!next?.startsWith("/")) return fallback;
  // Parse rather than prefix-check: browsers strip tabs and newlines, so "/\t/evil.com" becomes "//evil.com".
  const url = new URL(next, window.location.origin);
  return url.origin === window.location.origin ? url.pathname + url.search + url.hash : fallback;
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
