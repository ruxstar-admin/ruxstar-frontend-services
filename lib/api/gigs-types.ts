/**
 * Freelancers' API shapes, taken straight from the generated spec so they can't drift from the backend's
 * `src/modules/gigs/contracts.ts`. Amounts are paise; times are ISO strings.
 */

import type { Message } from "./chats";
import type { paths } from "./schema";

type Ok<R> = R extends { responses: infer Rs } ? Rs[keyof Rs & (200 | 201)] : never;
type Data<R> = Ok<R> extends { content: { "application/json": { data: infer D } } } ? D : never;
type Body<R> = R extends { requestBody?: { content: { "application/json": infer B } } } ? B : never;
type Query<R> = R extends { parameters: { query?: infer Q } } ? NonNullable<Q> : never;
type Item<T> = T extends readonly (infer I)[] ? I : T;

export type GigsRules = Data<paths["/v1/gigs/rules"]["get"]>;
export type GigsLimits = GigsRules["limits"];
export type GigCategoryOption = GigsRules["categories"][number];

export type GigCard = Item<Data<paths["/v1/gigs/"]["get"]>>;
export type GigsQuery = Omit<Query<paths["/v1/gigs/"]["get"]>, "cursor" | "limit">;
export type GigDetail = Data<paths["/v1/gigs/{id}"]["get"]>;
export type GigPackage = GigDetail["packages"][number];
/** Basic, Standard and Premium, in that order: a gig with two packages has basic and standard. */
export type GigTier = GigPackage["tier"];
export type GigQuestion = GigDetail["questions"][number];
export type GigPhoto = GigDetail["photos"][number];
export type GigStatus = GigDetail["status"];
export type FreelancerRef = GigCard["freelancer"];
export type GigOffers = Data<paths["/v1/gigs/{id}/offers"]["get"]>;

export type FreelancerPage = Data<paths["/v1/gigs/freelancers/{id}"]["get"]>;
export type PortfolioLink = FreelancerPage["portfolio"]["links"][number];

export type MyFreelancer = Data<paths["/v1/gigs/me/"]["get"]>;
export type FreelancerInput = Body<paths["/v1/gigs/me/"]["post"]>;
export type FreelancerPatch = Body<paths["/v1/gigs/me/"]["patch"]>;
export type MyGig = Data<paths["/v1/gigs/me/gigs/{id}"]["get"]>;
export type GigInput = Body<paths["/v1/gigs/me/gigs"]["post"]>;
export type GigPatch = Body<paths["/v1/gigs/me/gigs/{id}"]["patch"]>;

/**
 * `paid` waits for the freelancer to accept. `in_progress` is being worked on (again, after a revision).
 * `delivered` waits for the customer. `disputed`: Ruxstar decides. `completed`: the freelancer is paid.
 */
export type GigOrder = Data<paths["/v1/gigs/orders/{id}"]["get"]>;
export type GigOrderStatus = GigOrder["status"];
export type GigFile = GigOrder["files"][number];
export type GigDelivery = GigOrder["deliveries"][number];
export type GigOrderInput = Body<paths["/v1/gigs/{id}/order"]["post"]>;
export type PlacedGigOrder = Data<paths["/v1/gigs/{id}/order"]["post"]>;
export type FileUse = Query<paths["/v1/gigs/files"]["post"]>["use"];
export type UploadedFile = Data<paths["/v1/gigs/files"]["post"]>;
export type DeliverInput = Body<paths["/v1/gigs/desk/orders/{id}/deliver"]["post"]>;

/** A custom offer, as it shows in a chat. */
export type QuoteCard = NonNullable<Message["quote"]>;
export type QuoteStatus = QuoteCard["status"];
/** GET /v1/gigs/quotes/:id: the whole offer card, with its chat. */
export type QuoteState = Data<paths["/v1/gigs/quotes/{id}"]["get"]>;
export type QuoteInput = Body<paths["/v1/social/chats/{id}/quotes"]["post"]>;
export type QuotePayInput = Body<paths["/v1/gigs/quotes/{id}/pay"]["post"]>;

export type ConsoleFreelancer = Data<paths["/v1/ruxstar/gigs/freelancers/{id}"]["get"]>;
export type ConsoleGig = Data<paths["/v1/ruxstar/gigs/listings/{id}"]["get"]>;
export type ConsoleGigsQuery = Omit<Query<paths["/v1/ruxstar/gigs/listings"]["get"]>, "cursor" | "limit">;
export type ConsoleGigOrdersQuery = Omit<Query<paths["/v1/ruxstar/gigs/orders"]["get"]>, "cursor" | "limit">;
export type DecideInput = Body<paths["/v1/ruxstar/gigs/orders/{id}/decide"]["post"]>;
export type DisputeOutcome = DecideInput["outcome"];

/** Ruxstar's freelancer rules as the console edits them. */
export type GigsRuleSettings = NonNullable<Item<Data<paths["/v1/ruxstar/modules"]["get"]>>["gigsRules"]>;
export type GigCategory = GigsRuleSettings["categories"][number];
