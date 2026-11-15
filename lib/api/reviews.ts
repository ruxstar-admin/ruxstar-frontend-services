import { signedIn } from "./account";
import { api, API_URL, newIdempotencyKey, unwrap } from "./client";
import type { paths } from "./schema";
import type { Page } from "./social";

type Data<T> = T extends { content: { "application/json": { data: infer D } } } ? D : never;

/** A business's live reviews, across everything it sells. `average` is to one decimal, and null until there are 3 reviews. */
export type Rating = Data<paths["/v1/pod/shops/{id}"]["get"]["responses"][200]>["rating"];
/** GET /v1/pod/shops/:id/reviews: a review as anyone sees it. */
export type Review = Data<paths["/v1/pod/shops/{id}/reviews"]["get"]["responses"][200]>[number];
/** The customer's own review of an order. A removed one keeps Ruxstar's reason and can't change. */
export type MyReview = NonNullable<Data<paths["/v1/pod/orders/{id}/review"]["get"]["responses"][200]>>;
/** A review as the shop sees it, with the order it was about. */
export type ShopReview = Data<paths["/v1/vendor/businesses/{id}/reviews"]["get"]["responses"][200]>[number];
export type ReviewCase = Data<paths["/v1/ruxstar/reports/reviews"]["get"]["responses"][200]>[number];
export type ReviewReportReason = NonNullable<paths["/v1/pod/reviews/{id}/report"]["post"]["requestBody"]>["content"]["application/json"]["reason"];
/** Print, events, coaching, turf, stays or shop. Print reviews written before the others came have no `module`. */
export type ReviewModule = NonNullable<Review["module"]>;
/** Modules whose reviews are of an event, a course, a ground, a property or a product. */
export type ListingModule = Exclude<ReviewModule, "pod">;
/** What a listing review is about. */
export type ListingType = NonNullable<Review["listing"]>["type"];

const path = (id: string) => ({ params: { path: { id } } });
const pageOf = <T>(envelope: { data: T[]; meta: { nextCursor?: string | null } }): Page<T> => ({ items: envelope.data, nextCursor: envelope.meta.nextCursor ?? null });
/** A shop order has a review per product. */
const productPath = (orderId: string, productId = "") => ({ params: { path: { id: orderId, productId } } });

// The customer's side. Each module has the same review routes under its own path.

type Mine = { data: MyReview | null };

/** Null until the customer reviews the order. A shop order's reviews are per product. */
export const myReview = async (orderId: string, module: ReviewModule = "pod", productId?: string) =>
  (
    await signedIn(() =>
      unwrap<Mine>(
        module === "events"
          ? api.GET("/v1/events/orders/{id}/review", path(orderId))
          : module === "coaching"
            ? api.GET("/v1/coaching/orders/{id}/review", path(orderId))
            : module === "turf"
              ? api.GET("/v1/turf/orders/{id}/review", path(orderId))
              : module === "stays"
                ? api.GET("/v1/stays/orders/{id}/review", path(orderId))
                : module === "shop"
                  ? api.GET("/v1/shop/orders/{id}/products/{productId}/review", productPath(orderId, productId))
                  : api.GET("/v1/pod/orders/{id}/review", path(orderId)),
      ),
    )
  ).data;

/** While the order is open for reviews. Leaving out `text` keeps it; null clears it. */
export const writeReview = async (orderId: string, body: { rating: number; text?: string | null }, module: ReviewModule = "pod", productId?: string) =>
  (
    await signedIn(() =>
      unwrap<Mine>(
        module === "events"
          ? api.PUT("/v1/events/orders/{id}/review", { ...path(orderId), body })
          : module === "coaching"
            ? api.PUT("/v1/coaching/orders/{id}/review", { ...path(orderId), body })
            : module === "turf"
              ? api.PUT("/v1/turf/orders/{id}/review", { ...path(orderId), body })
              : module === "stays"
                ? api.PUT("/v1/stays/orders/{id}/review", { ...path(orderId), body })
                : module === "shop"
                  ? api.PUT("/v1/shop/orders/{id}/products/{productId}/review", { ...productPath(orderId, productId), body })
                  : api.PUT("/v1/pod/orders/{id}/review", { ...path(orderId), body }),
      ),
    )
  ).data!;

export const deleteReview = async (orderId: string, module: ReviewModule = "pod", productId?: string) => {
  await signedIn(() =>
    unwrap<unknown>(
      module === "events"
        ? api.DELETE("/v1/events/orders/{id}/review", path(orderId))
        : module === "coaching"
          ? api.DELETE("/v1/coaching/orders/{id}/review", path(orderId))
          : module === "turf"
            ? api.DELETE("/v1/turf/orders/{id}/review", path(orderId))
            : module === "stays"
              ? api.DELETE("/v1/stays/orders/{id}/review", path(orderId))
              : module === "shop"
                ? api.DELETE("/v1/shop/orders/{id}/products/{productId}/review", productPath(orderId, productId))
                : api.DELETE("/v1/pod/orders/{id}/review", path(orderId)),
    ),
  );
};

export const shopReviews = async (shopId: string, cursor?: string): Promise<Page<Review>> =>
  pageOf(await signedIn(() => unwrap(api.GET("/v1/pod/shops/{id}/reviews", { params: { path: { id: shopId }, query: { cursor } } }))));

/** An event's, a course's, a ground's, a property's or a product's live reviews, newest first. No sign-in needed. */
export const listingReviews = async (module: ListingModule, id: string, cursor?: string, limit?: number): Promise<Page<Review>> => {
  const params = { params: { path: { id }, query: { cursor, limit } } };
  return pageOf(
    await signedIn(() =>
      unwrap<{ data: Review[]; meta: { nextCursor: string | null } }>(
        module === "events"
          ? api.GET("/v1/events/{id}/reviews", params)
          : module === "turf"
            ? api.GET("/v1/turf/{id}/reviews", params)
            : module === "stays"
              ? api.GET("/v1/stays/{id}/reviews", params)
              : module === "shop"
                ? api.GET("/v1/shop/products/{id}/reviews", params)
                : api.GET("/v1/coaching/{id}/reviews", params),
      ),
    ),
  );
};

/**
 * For the server: the first few reviews of an event, a course, a ground or a product, cached for a minute like the page.
 * Null when the API doesn't answer; the page then shows none.
 */
export async function fetchListingReviews(module: ListingModule, id: string, limit: number): Promise<Page<Review> | null> {
  if (!/^[a-f0-9]{24}$/.test(id)) return null;
  const at = module === "shop" ? `shop/products/${id}` : `${module}/${id}`;
  try {
    const res = await fetch(`${API_URL}/v1/${at}/reviews?limit=${limit}`, { headers: { "X-Client": "web" }, next: { revalidate: 60 } });
    if (!res.ok) return null;
    return pageOf((await res.json()) as { data: Review[]; meta: { nextCursor?: string | null } });
  } catch {
    return null;
  }
}

/** One open report per review; the writer isn't told. */
export const reportReview = async (reviewId: string, reason: ReviewReportReason, note?: string, module: ReviewModule = "pod") => {
  const body = { reason, ...(note ? { note } : {}) };
  await signedIn(() =>
    unwrap<unknown>(
      module === "events"
        ? api.POST("/v1/events/reviews/{id}/report", { ...path(reviewId), body })
        : module === "coaching"
          ? api.POST("/v1/coaching/reviews/{id}/report", { ...path(reviewId), body })
          : module === "turf"
            ? api.POST("/v1/turf/reviews/{id}/report", { ...path(reviewId), body })
            : module === "stays"
              ? api.POST("/v1/stays/reviews/{id}/report", { ...path(reviewId), body })
              : module === "shop"
                ? api.POST("/v1/shop/reviews/{id}/report", { ...path(reviewId), body })
                : api.POST("/v1/pod/reviews/{id}/report", { ...path(reviewId), body }),
    ),
  );
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

export const moduleOf = (review: { module?: ReviewModule }): ReviewModule => review.module ?? "pod";

/** The label over the business's reply. */
export const REPLY_FROM: Record<ReviewModule, string> = {
  pod: "From the shop",
  events: "From the organiser",
  coaching: "From the institute",
  turf: "From the ground",
  stays: "From the property",
  shop: "From the shop",
};

/** What was reviewed, for people who see reviews of every kind: "Event", "Course", or "Order" for print. */
export const REVIEWED_WORD: Record<ReviewModule, string> = { pod: "Order", events: "Event", coaching: "Course", turf: "Ground", stays: "Property", shop: "Product" };

/** The order a review came from: "Order #1234", "Booking #1234", "Enrolment #1234". */
export const ORDER_WORD: Record<ReviewModule, string> = { pod: "Order", events: "Booking", coaching: "Enrolment", turf: "Booking", stays: "Reservation", shop: "Order" };

/** Where anyone can read the reviews it sits with. */
export function reviewsHref(review: { module?: ReviewModule; listing?: { type: ListingType; id: string } | null }, shopId: string): string {
  if (review.listing) {
    const { type, id } = review.listing;
    return type === "event"
      ? `/events/${id}`
      : type === "course"
        ? `/courses/${id}`
        : type === "property"
          ? `/stays/${id}`
          : type === "product"
            ? `/products/${id}`
            : `/grounds/${id}`;
  }
  return `/b/${shopId}/reviews`;
}
