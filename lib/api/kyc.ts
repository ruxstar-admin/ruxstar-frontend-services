import { signedIn } from "./account";
import { API_URL, api, newIdempotencyKey, unwrap } from "./client";
import type { paths } from "./schema";

type Json<P extends keyof paths, M extends keyof paths[P]> = paths[P][M] extends {
  responses: { 200: { content: { "application/json": infer B } } };
}
  ? B
  : never;

export type Overview = Json<"/v1/kyc/", "get">["data"];
export type BaseCase = Overview["base"];
export type VendorCase = Overview["vendor"];
export type CaseStatus = BaseCase["status"];
export type StepStatus = BaseCase["steps"]["aadhaar"]["status"];
export type RuxstarCard = Json<"/v1/kyc/card", "get">["data"];
export type VendorDetails = paths["/v1/kyc/vendor"]["put"]["requestBody"]["content"]["application/json"];
export type ReviewCase = Json<"/v1/ruxstar/kyc/{id}", "get">["data"];
export type ReviewStatus = NonNullable<NonNullable<paths["/v1/ruxstar/kyc"]["get"]["parameters"]["query"]>["status"]>;
export type Track = ReviewCase["track"];

export const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const PINCODE = /^[1-9][0-9]{5}$/;

export const getKyc = async () => (await signedIn(() => unwrap(api.GET("/v1/kyc/")))).data;

/** A DigiLocker link. Send the browser there; it comes back to /kyc/done. */
export const startAadhaar = async () => (await signedIn(() => unwrap(api.POST("/v1/kyc/base/aadhaar")))).data.url;

export const checkAadhaar = async () => (await signedIn(() => unwrap(api.POST("/v1/kyc/base/aadhaar/check")))).data;

export const checkPan = async (pan: string) =>
  (await signedIn(() => unwrap(api.POST("/v1/kyc/base/pan", { body: { pan } })))).data;

/** The spec has no body for this route (it is the raw image), so it skips the typed client. */
async function postSelfie(photo: Blob) {
  const response = await fetch(`${API_URL}/v1/kyc/base/face`, {
    method: "POST",
    credentials: "include",
    headers: { "X-Client": "web", "Content-Type": photo.type },
    body: photo,
  });
  const parsed: unknown = await response.json().catch(() => undefined);
  return response.ok ? { data: parsed as { data: Overview }, response } : { error: parsed, response };
}

export const sendSelfie = async (photo: Blob) => (await signedIn(() => unwrap(postSelfie(photo)))).data;

export const submitIdentity = async () => (await signedIn(() => unwrap(api.POST("/v1/kyc/base/submit")))).data;

export const saveVendor = async (body: VendorDetails) =>
  (await signedIn(() => unwrap(api.PUT("/v1/kyc/vendor", { body })))).data;

export const submitVendor = async () => (await signedIn(() => unwrap(api.POST("/v1/kyc/vendor/submit")))).data;

export const getCard = async () => (await signedIn(() => unwrap(api.GET("/v1/kyc/card")))).data;

// Review queue, for admins and staff with the kyc grants.

export const reviewQueue = async (status: ReviewStatus, cursor?: string) => {
  const res = await signedIn(() => unwrap(api.GET("/v1/ruxstar/kyc", { params: { query: { status, cursor } } })));
  return { items: res.data, nextCursor: res.meta.nextCursor ?? null };
};

export const reviewCase = async (id: string) =>
  (await signedIn(() => unwrap(api.GET("/v1/ruxstar/kyc/{id}", { params: { path: { id } } })))).data;

/** One key per decision, kept across retries of that same click. */
export const approveCase = async (id: string, key = newIdempotencyKey()) =>
  (
    await signedIn(() =>
      unwrap(api.POST("/v1/ruxstar/kyc/{id}/approve", { params: { path: { id } }, headers: { "Idempotency-Key": key } })),
    )
  ).data;

export const rejectCase = async (id: string, reason: string, key = newIdempotencyKey()) =>
  (
    await signedIn(() =>
      unwrap(
        api.POST("/v1/ruxstar/kyc/{id}/reject", { params: { path: { id } }, headers: { "Idempotency-Key": key }, body: { reason } }),
      ),
    )
  ).data;
