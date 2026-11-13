import { signedIn } from "./account";
import { api, newIdempotencyKey, unwrap } from "./client";
import type { paths } from "./schema";
import type { Page } from "./social";

type Data<T> = T extends { content: { "application/json": { data: infer D } } } ? D : never;

/** A shop's live reviews. `average` is to one decimal, and null until there are 3 reviews. */
export type Rating = Data<paths["/v1/pod/shops/{id}"]["get"]["responses"][200]>["rating"];
/** GET /v1/pod/shops/:id/reviews: a review as anyone sees it. */
export type Review = Data<paths["/v1/pod/shops/{id}/reviews"]["get"]["responses"][200]>[number];
/** The customer's own review of an order. A removed one keeps Ruxstar's reason and can't change. */
export type MyReview = NonNullable<Data<paths["/v1/pod/orders/{id}/review"]["get"]["responses"][200]>>;
/** A review as the shop sees it, with the order it was about. */
export type ShopReview = Data<paths["/v1/vendor/businesses/{id}/reviews"]["get"]["responses"][200]>[number];
export type ReviewCase = Data<paths["/v1/ruxstar/reports/reviews"]["get"]["responses"][200]>[number];
export type ReviewReportReason = NonNullable<paths["/v1/pod/reviews/{id}/report"]["post"]["requestBody"]>["content"]["application/json"]["reason"];

const path = (id: string) => ({ params: { path: { id } } });
const pageOf = <T>(envelope: { data: T[]; meta: { nextCursor?: string | null } }): Page<T> => ({ items: envelope.data, nextCursor: envelope.meta.nextCursor ?? null });

// The customer's side.

/** Null until the customer reviews the order. */
export const myReview = async (orderId: string) => (await signedIn(() => unwrap(api.GET("/v1/pod/orders/{id}/review", path(orderId))))).data;

/** For 30 days after delivery. Leaving out `text` keeps it; null clears it. */
export const writeReview = async (orderId: string, body: { rating: number; text?: string | null }) =>
  (await signedIn(() => unwrap(api.PUT("/v1/pod/orders/{id}/review", { ...path(orderId), body })))).data!;

export const deleteReview = async (orderId: string) => {
  await signedIn(() => unwrap(api.DELETE("/v1/pod/orders/{id}/review", path(orderId))));
};

export const shopReviews = async (shopId: string, cursor?: string): Promise<Page<Review>> =>
  pageOf(await signedIn(() => unwrap(api.GET("/v1/pod/shops/{id}/reviews", { params: { path: { id: shopId }, query: { cursor } } }))));

/** One open report per review; the writer isn't told. */
export const reportReview = async (reviewId: string, reason: ReviewReportReason, note?: string) => {
  await signedIn(() => unwrap(api.POST("/v1/pod/reviews/{id}/report", { ...path(reviewId), body: { reason, ...(note ? { note } : {}) } })));
};

// The shop's side: the owner's by business id, the team's by place id (with "Reply to reviews").

export const businessReviews = async (businessId: string, cursor?: string): Promise<Page<ShopReview>> =>
  pageOf(await signedIn(() => unwrap(api.GET("/v1/vendor/businesses/{id}/reviews", { params: { path: { id: businessId }, query: { cursor } } }))));

export const replyAsOwner = async (businessId: string, reviewId: string, text: string) =>
  (
    await signedIn(() =>
      unwrap(api.PUT("/v1/vendor/businesses/{id}/reviews/{reviewId}/reply", { params: { path: { id: businessId, reviewId } }, body: { text } })),
    )
  ).data;

export const removeOwnerReply = async (businessId: string, reviewId: string) =>
  (await signedIn(() => unwrap(api.DELETE("/v1/vendor/businesses/{id}/reviews/{reviewId}/reply", { params: { path: { id: businessId, reviewId } } })))).data;

export const workReviews = async (placeId: string, cursor?: string): Promise<Page<ShopReview>> =>
  pageOf(await signedIn(() => unwrap(api.GET("/v1/employment/{id}/reviews", { params: { path: { id: placeId }, query: { cursor } } }))));

export const replyAsTeam = async (placeId: string, reviewId: string, text: string) =>
  (await signedIn(() => unwrap(api.PUT("/v1/employment/{id}/reviews/{reviewId}/reply", { params: { path: { id: placeId, reviewId } }, body: { text } })))).data;

export const removeTeamReply = async (placeId: string, reviewId: string) =>
  (await signedIn(() => unwrap(api.DELETE("/v1/employment/{id}/reviews/{reviewId}/reply", { params: { path: { id: placeId, reviewId } } })))).data;

// The console.

export const reviewReports = async (status: "open" | "closed", cursor?: string): Promise<Page<ReviewCase>> =>
  pageOf(await signedIn(() => unwrap(api.GET("/v1/ruxstar/reports/reviews", { params: { query: { status, cursor } } }))));

/** Pass the same key when retrying the same click. */
export const keepReview = async (reviewId: string, key = newIdempotencyKey()) =>
  (await signedIn(() => unwrap(api.POST("/v1/ruxstar/reports/reviews/{reviewId}/keep", { params: { path: { reviewId } }, headers: { "Idempotency-Key": key } })))).data;

/** The customer is told the reason. */
export const removeReview = async (reviewId: string, reason: string, key = newIdempotencyKey()) =>
  (
    await signedIn(() =>
      unwrap(api.POST("/v1/ruxstar/reports/reviews/{reviewId}/remove", { params: { path: { reviewId } }, body: { reason }, headers: { "Idempotency-Key": key } })),
    )
  ).data;

// Words, the same as the app.

export const REVIEW_TEXT_MAX = 500;

export const starsLabel = (n: number) => `${n} star${n === 1 ? "" : "s"}`;

/** "4.3 (12)", or "New" before a shop has 3 reviews. */
export const ratingShort = (rating: Rating) => (rating.average === null ? "New" : `${rating.average.toFixed(1)} (${rating.count})`);

/** "4.3 from 12 reviews", or what a newer shop has so far. */
export function ratingLine(rating: Rating): string {
  if (rating.average !== null) return `${rating.average.toFixed(1)} from ${rating.count} reviews`;
  if (rating.count === 0) return "New: no reviews yet";
  return `New: ${rating.count} review${rating.count === 1 ? "" : "s"} so far`;
}

export const REPORT_REASONS: { key: ReviewReportReason; label: string }[] = [
  { key: "spam", label: "Spam or ads" },
  { key: "fake", label: "Not a real customer" },
  { key: "abuse", label: "Abusive" },
  { key: "other", label: "Something else" },
];

export const STAR_WORDS: Record<number, string> = { 1: "Poor", 2: "Not great", 3: "Okay", 4: "Good", 5: "Excellent" };
