import { signedIn } from "./account";
import { API_URL, ApiError, api, newIdempotencyKey, unwrap } from "./client";
import type { paths } from "./schema";

type Json<P extends keyof paths, M extends keyof paths[P]> = paths[P][M] extends {
  responses: { 200: { content: { "application/json": infer B } } };
}
  ? B
  : never;

export type Overview = Json<"/v1/kyc/", "get">["data"];
export type BaseCase = Overview["base"];
export type CaseStatus = BaseCase["status"];
export type StepStatus = BaseCase["steps"]["aadhaar"]["status"];
export type RuxstarCard = Json<"/v1/kyc/card", "get">["data"];
export type ReviewCase = Json<"/v1/ruxstar/kyc/{id}", "get">["data"];
export type ReviewStatus = NonNullable<NonNullable<paths["/v1/ruxstar/kyc"]["get"]["parameters"]["query"]>["status"]>;
/** `base` is identity; `delivery` is a delivery partner's licence and vehicle. */
export type ReviewTrack = ReviewCase["track"];
/** Delivery partner: the driving licence and the bike or scooter, on top of approved identity. */
export type DeliveryCase = Overview["delivery"];
export type VehicleType = NonNullable<DeliveryCase["vehicle"]["type"]>;
export type DeliveryPhotoKind = paths["/v1/kyc/delivery/photos/{kind}"]["put"]["parameters"]["path"]["kind"];
type DeliveryPatch = paths["/v1/kyc/delivery/"]["patch"]["requestBody"]["content"]["application/json"];

export const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
/** The API's patterns: the state, the RTO, then the year and serial; plates like TS09AB1234 or the BH series. Same as the app. */
const DRIVING_LICENCE = /^[A-Z]{2}\d{2}[0-9A-Z]{11,12}$/;
const PLATE = /^([A-Z]{2}\d{1,2}[A-Z]{0,3}\d{4}|\d{2}BH\d{4}[A-Z]{1,2})$/;

/** Upper case without spaces, dashes, dots or slashes, as the API stores licence and plate numbers. */
export const tidyNumber = (value: string) => value.toUpperCase().replace(/[\s\-./]/g, "");
export const isValidDrivingLicence = (value: string) => DRIVING_LICENCE.test(tidyNumber(value));
export const isValidPlate = (value: string) => PLATE.test(tidyNumber(value));

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

export const getCard = async () => (await signedIn(() => unwrap(api.GET("/v1/kyc/card")))).data;

/** Delivery partner details, after identity. Send only what changed; numbers may have spaces and dashes. */
export const saveDelivery = async (body: DeliveryPatch) => (await signedIn(() => unwrap(api.PATCH("/v1/kyc/delivery/", { body })))).data;

/** The spec has no body for this route (it is the raw image), so it skips the typed client. */
async function putDeliveryPhoto(kind: DeliveryPhotoKind, photo: Blob) {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/v1/kyc/delivery/photos/${kind}`, {
      method: "PUT",
      credentials: "include",
      headers: { "X-Client": "web", "Content-Type": photo.type },
      body: photo,
    });
  } catch {
    throw new ApiError(0, "NETWORK", "The photo didn't upload. Check your connection and try again.");
  }
  const parsed: unknown = await response.json().catch(() => undefined);
  return response.ok ? { data: parsed as { data: Overview }, response } : { error: parsed, response };
}

/** Replaces the photo before. Kept privately for the Ruxstar team. */
export const sendDeliveryPhoto = async (kind: DeliveryPhotoKind, photo: Blob) => (await signedIn(() => unwrap(putDeliveryPhoto(kind, photo)))).data;

export const submitDelivery = async () => (await signedIn(() => unwrap(api.POST("/v1/kyc/delivery/submit")))).data;

// Review queue, for admins and staff with the kyc grants.

export const reviewQueue = async (status: ReviewStatus, track: ReviewTrack, cursor?: string) => {
  const res = await signedIn(() => unwrap(api.GET("/v1/ruxstar/kyc", { params: { query: { status, track, cursor } } })));
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
