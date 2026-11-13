import { signedIn } from "./account";
import { api, newIdempotencyKey, unwrap } from "./client";
import type { paths } from "./schema";
import type { Page } from "./social";

type Data<T> = T extends { content: { "application/json": { data: infer D } } } ? D : never;

/** GET /v1/vendor/businesses/:id/team. Invites count towards `max`. */
export type Team = Data<paths["/v1/vendor/businesses/{id}/team"]["get"]["responses"][200]>;
export type TeamMember = Team["members"][number];
export type PermissionInfo = Team["permissions"][number];
export type TeamPermission = PermissionInfo["key"];
/** GET /v1/employment: your invites and the businesses you work at. */
export type Work = Data<paths["/v1/employment/"]["get"]["responses"][200]>;
export type WorkInvite = Work["invites"][number];
export type WorkPlace = Work["places"][number];
/** GET /v1/vendor/businesses/:id/activity: who did what, for the owner. Customers and the Ruxstar team stay unnamed. */
export type ActivityEntry = Data<paths["/v1/vendor/businesses/{id}/activity"]["get"]["responses"][200]>[number];

const team = (id: string) => ({ params: { path: { id } } });
const member = (id: string, memberId: string) => ({ params: { path: { id, memberId } } });
const place = (id: string) => ({ params: { path: { id } } });

// The owner's team at one business. Only the owner manages it.

export const getTeam = async (businessId: string) => (await signedIn(() => unwrap(api.GET("/v1/vendor/businesses/{id}/team", team(businessId))))).data;

/** Pass the same key when retrying the same click. */
export const inviteToTeam = async (businessId: string, username: string, permissions: TeamPermission[], key = newIdempotencyKey()) =>
  (
    await signedIn(() =>
      unwrap(api.POST("/v1/vendor/businesses/{id}/team", { ...team(businessId), body: { username, permissions }, headers: { "Idempotency-Key": key } })),
    )
  ).data;

export const setMemberPermissions = async (businessId: string, memberId: string, permissions: TeamPermission[]) =>
  (await signedIn(() => unwrap(api.PATCH("/v1/vendor/businesses/{id}/team/{memberId}", { ...member(businessId, memberId), body: { permissions } })))).data;

/** Removes a member or cancels an invite. */
export const removeMember = async (businessId: string, memberId: string) => {
  await signedIn(() => unwrap(api.DELETE("/v1/vendor/businesses/{id}/team/{memberId}", member(businessId, memberId))));
};

/** What happened at the business, newest first; `by` is one person's (a user id). */
export const businessActivity = async (businessId: string, by?: string, cursor?: string): Promise<Page<ActivityEntry>> => {
  const envelope = await signedIn(() => unwrap(api.GET("/v1/vendor/businesses/{id}/activity", { params: { path: { id: businessId }, query: { by, cursor } } })));
  return { items: envelope.data, nextCursor: envelope.meta.nextCursor ?? null };
};

// The Work area.

export const getWork = async (): Promise<Work> => (await signedIn(() => unwrap(api.GET("/v1/employment/")))).data;

export const acceptInvite = async (id: string) => (await signedIn(() => unwrap(api.POST("/v1/employment/{id}/accept", place(id))))).data;

export const declineInvite = async (id: string) => {
  await signedIn(() => unwrap(api.POST("/v1/employment/{id}/decline", place(id))));
};

export const leaveTeam = async (id: string) => {
  await signedIn(() => unwrap(api.POST("/v1/employment/{id}/leave", place(id))));
};

// Words, the same as the app.

const DAY_MS = 24 * 60 * 60_000;

/**
 * Switches one permission. Turning one on brings what it needs; turning one off drops what needs it, so
 * "Accept and move orders" can never be on without "See orders". Kept in the catalog's order.
 */
export function togglePermission(catalog: PermissionInfo[], current: TeamPermission[], key: TeamPermission, on: boolean): TeamPermission[] {
  const set = new Set(current);
  if (on) {
    set.add(key);
    const needs = catalog.find((p) => p.key === key)?.needs;
    if (needs) set.add(needs);
  } else {
    set.delete(key);
    for (const p of catalog) if (p.needs === key) set.delete(p.key);
  }
  return catalog.filter((p) => set.has(p.key)).map((p) => p.key);
}

/** "See orders, Open and close the shop" or "See orders and 3 more". */
export function permissionsLine(catalog: PermissionInfo[], permissions: TeamPermission[]): string {
  const labels = catalog.filter((p) => permissions.includes(p.key)).map((p) => p.label);
  if (!labels.length) return "Nothing yet";
  if (labels.length <= 2) return labels.join(", ");
  return `${labels[0]} and ${labels.length - 1} more`;
}

/** "Invite ends today", "Invite ends tomorrow", "Invite ends in 5 days". */
export function inviteEnds(expiresAt: string, now = Date.now()): string {
  const days = Math.ceil((new Date(expiresAt).getTime() - now) / DAY_MS);
  if (days <= 0) return "Invite ends today";
  if (days === 1) return "Invite ends tomorrow";
  return `Invite ends in ${days} days`;
}

export const MEMBER_STATUS: Record<TeamMember["status"], { label: string; tone: "success" | "warning" | "neutral" }> = {
  active: { label: "Working", tone: "success" },
  waiting: { label: "Getting verified", tone: "warning" },
  invited: { label: "Invited", tone: "neutral" },
};

export const ACCESS: Record<WorkPlace["access"], { label: string; tone: "success" | "warning" | "danger"; note: string | null }> = {
  on: { label: "Working", tone: "success", note: null },
  verify: { label: "Get verified", tone: "warning", note: "Nothing works here until your identity verification (Aadhaar, PAN and a selfie) is approved." },
  on_hold: { label: "On hold", tone: "danger", note: "Ruxstar has this business on hold, so nothing works here for now." },
};

export const OWNER_ONLY = "Always yours: withdrawals, payment details, publishing, deleting the business and the team itself.";

export const cleanUsername = (value: string) => value.trim().replace(/^@/, "").toLowerCase();
export const USERNAME = /^[a-z0-9_.]{3,20}$/;
