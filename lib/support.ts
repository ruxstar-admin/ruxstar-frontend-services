import type { TagTone } from "@/components/ui";
import { ApiError } from "@/lib/api/client";
import type { ContextType, SupportCategory, SupportPriority, SupportStatus } from "@/lib/api/support";

export const SUBJECT_MIN = 3;
export const SUBJECT_MAX = 80;
export const TEXT_MAX = 2000;
export const PHOTOS_MAX = 3;
/** The API keeps help photos at 1600 px on the long side. */
export const PHOTO_SIDE = 1600;

export const CATEGORY_LABEL: Record<SupportCategory, string> = {
  orders: "Orders & payments",
  refunds: "Refunds",
  verification: "Verification",
  business: "My business",
  delivery: "Delivery",
  account: "Account & sign-in",
  safety: "Safety & reports",
  app: "App problem",
  other: "Other",
};

export const CATEGORIES = (Object.keys(CATEGORY_LABEL) as SupportCategory[]).map((value) => ({ value, label: CATEGORY_LABEL[value] }));
export const isCategory = (value: string | null): value is SupportCategory => !!value && Object.hasOwn(CATEGORY_LABEL, value);

/** How a ticket reads to the person who opened it. */
export const STATUS: Record<SupportStatus, { label: string; tone: TagTone }> = {
  open: { label: "With Ruxstar", tone: "solid" },
  waiting: { label: "Replied", tone: "warning" },
  resolved: { label: "Solved", tone: "success" },
  closed: { label: "Closed", tone: "neutral" },
};

/** How a ticket reads to the Ruxstar team. */
export const DESK_STATUS: Record<SupportStatus, { label: string; tone: TagTone }> = {
  open: { label: "Open", tone: "solid" },
  waiting: { label: "Waiting on them", tone: "neutral" },
  resolved: { label: "Resolved", tone: "success" },
  closed: { label: "Closed", tone: "neutral" },
};

export const PRIORITY: Record<SupportPriority, { label: string; tone: TagTone }> = {
  urgent: { label: "Urgent", tone: "danger" },
  high: { label: "High", tone: "warning" },
  normal: { label: "Normal", tone: "neutral" },
  low: { label: "Low", tone: "neutral" },
};

export const PRIORITIES = (Object.keys(PRIORITY) as SupportPriority[]).map((value) => ({ value, label: PRIORITY[value].label }));

export const CONTEXT_TYPES: readonly ContextType[] = ["order", "business", "verification", "post", "coupon"];

/** The API's own message when it sent one; a 401 with a pass means the pass ran out. */
export function supportErrorText(err: unknown, hold = false): string {
  if (!(err instanceof ApiError) || err.status === 0) return "Could not reach Ruxstar. Check your connection and try again.";
  if (hold && err.status === 401) return "Your support access ended. Sign in again to keep messaging support.";
  if (err.status >= 500) return "Something went wrong on our side. Try again.";
  return err.message;
}

/** Where the help pages live: signed in, or the pages an account on hold reaches with its pass. */
export const supportBase = (hold: boolean) => (hold ? "/hold" : "/support");

/** A "Contact support" link: a new ticket with the topic, and what it is about, filled in. */
export function contactSupport(category: SupportCategory, context?: { type: ContextType; id: string; label: string }, hold = false): string {
  const query = new URLSearchParams({ category, ...(context ? { type: context.type, id: context.id, label: context.label } : {}) });
  return `${supportBase(hold)}/new?${query}`;
}

/** "Solved. Reply by 21 Nov to reopen it.", or why it can't be. */
export function reopenLine(status: SupportStatus, reopenUntil: string | null): string | null {
  if (status === "closed") return "This ticket is closed. Open a new one if you still need help.";
  if (status === "resolved" && reopenUntil) {
    return `Solved. Reply by ${new Date(reopenUntil).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} to reopen it.`;
  }
  return null;
}
