import type { TagTone } from "@/components/ui";
import type {
  FreelancerInput,
  FreelancerPatch,
  GigCard,
  GigCategory,
  GigInput,
  GigOrder,
  GigOrderStatus,
  GigPackage,
  GigsLimits,
  GigsRules,
  GigStatus,
  GigTier,
  MyFreelancer,
  MyGig,
  QuoteCard,
  QuoteInput,
  QuoteStatus,
} from "@/lib/api/gigs";
import { money } from "@/lib/api/shops";
import { paiseOf } from "@/lib/events";
import type { TimelineStep } from "@/lib/stays";
import { ago } from "@/lib/time";

// Same words as the app.

export const TIERS: readonly GigTier[] = ["basic", "standard", "premium"];
export const TIER_LABEL: Record<GigTier, string> = { basic: "Basic", standard: "Standard", premium: "Premium" };

export const GIG_STATUS: Record<GigStatus, { label: string; tone: TagTone }> = {
  draft: { label: "Draft", tone: "neutral" },
  live: { label: "Live", tone: "success" },
  paused: { label: "Paused", tone: "warning" },
  removed: { label: "Taken down", tone: "danger" },
};

const STATUS: Record<GigOrderStatus, { customer: string; freelancer: string; tone: TagTone }> = {
  awaiting_payment: { customer: "Waiting for payment", freelancer: "Not paid yet", tone: "warning" },
  paid: { customer: "Waiting for the freelancer", freelancer: "New: accept or decline", tone: "solid" },
  in_progress: { customer: "In progress", freelancer: "In progress", tone: "solid" },
  delivered: { customer: "Delivered: check it", freelancer: "Delivered", tone: "success" },
  disputed: { customer: "Problem reported", freelancer: "Problem reported", tone: "warning" },
  completed: { customer: "Completed", freelancer: "Completed", tone: "success" },
  cancelled: { customer: "Cancelled", freelancer: "Cancelled", tone: "neutral" },
};

/** The badge for an order, worded for whoever is looking. A late order says so. */
export function orderStatus(o: Pick<GigOrder, "status" | "role" | "late">): { label: string; tone: TagTone } {
  if (o.late && (o.status === "in_progress" || o.status === "paid")) return { label: "Late", tone: "danger" };
  const s = STATUS[o.status];
  return { label: o.role === "freelancer" ? s.freelancer : s.customer, tone: s.tone };
}

export const isOpenOrder = (status: GigOrderStatus) => status !== "completed" && status !== "cancelled";

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
export const daysText = (n: number) => plural(n, "day");
export const revisionsText = (n: number) => (n === 0 ? "No revisions" : plural(n, "revision"));
/** "3 days delivery · 2 revisions" */
export const deliveryLine = (p: Pick<GigPackage, "deliveryDays" | "revisions">) => `${daysText(p.deliveryDays)} delivery · ${revisionsText(p.revisions)}`;

/** "From ₹1,500 · 2 days" on a gig card. */
export const cardPriceLine = (g: Pick<GigCard, "priceFrom" | "fastestDays">) => `From ${money(g.priceFrom)} · ${daysText(g.fastestDays)}`;

export const sortedPackages = <P extends Pick<GigPackage, "tier">>(packages: readonly P[]) => [...packages].sort((a, b) => TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier));

/** The package a customer first sees: the one asked for if the gig has it, else the first. */
export function pickPackage<P extends Pick<GigPackage, "tier">>(packages: readonly P[], wanted?: string | null): P | undefined {
  const sorted = sortedPackages(packages);
  return sorted.find((p) => p.tier === wanted) ?? sorted[0];
}

/** What the customer pays: the package less a discount (never below nothing), plus Ruxstar's fee. */
export function orderPrice(price: number, platformFee: number, discount = 0) {
  const off = Math.min(Math.max(discount, 0), price);
  return { items: price, discount: off, platformFee, total: price - off + platformFee };
}

/** The most a part refund can be: out of the freelancer's share, and less than what is left of the payment. */
export function maxPartRefund(o: Pick<GigOrder, "share" | "price" | "refunds">): number {
  const refunded = o.refunds.reduce((s, r) => s + r.amount, 0);
  return Math.max(0, Math.min(o.share ?? 0, o.price.total - refunded - 1));
}

/** "2 days left", "5 hours left", "Less than an hour left", or null once past. */
export function timeLeftText(iso: string, now: number = Date.now()): string | null {
  const hours = (Date.parse(iso) - now) / 3_600_000;
  if (hours <= 0) return null;
  if (hours < 1) return "Less than an hour left";
  if (hours < 48) return `${plural(Math.floor(hours), "hour")} left`;
  return `${Math.floor(hours / 24)} days left`;
}

const QUOTE_STATUS: Record<QuoteStatus, { label: string; tone: TagTone }> = {
  open: { label: "Open", tone: "solid" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
  expired: { label: "Expired", tone: "neutral" },
  paid: { label: "Paid", tone: "success" },
};

/** An offer past its pay-by time reads as expired even before the next refresh says so. */
export function quoteStatus(q: Pick<QuoteCard, "status" | "expiresAt">, now: number = Date.now()): QuoteStatus {
  return q.status === "open" && Date.parse(q.expiresAt) <= now ? "expired" : q.status;
}

export const quoteBadge = (q: Pick<QuoteCard, "status" | "expiresAt">, now: number = Date.now()) => QUOTE_STATUS[quoteStatus(q, now)];

/** Under an open offer: "3 days left to pay"; otherwise what happened. */
export function quoteNote(q: Pick<QuoteCard, "status" | "expiresAt">, now: number = Date.now()): string {
  const status = quoteStatus(q, now);
  if (status === "paid") return "Paid. The order has started.";
  if (status === "withdrawn") return "The freelancer withdrew this offer.";
  const left = timeLeftText(q.expiresAt, now);
  return status === "open" && left ? `${left} to pay` : "This offer has expired.";
}

const byRuxstar = (by: GigOrder["timeline"][number]["by"]) => by === "system" || by === "staff";

/** The order so far: paid, accepted, each delivery and its answer, then how it ended. Done steps show when; the next is now. */
export function orderTimeline(o: GigOrder): TimelineStep[] {
  const steps: { key: string; label: string; at?: string | null }[] = [{ key: "paid", label: o.quoteId ? "Offer paid" : "Paid", at: o.paidAt }];
  const end = () => {
    const now = steps.findIndex((s) => !s.at);
    return steps.map((s, i) => ({ key: s.key, title: s.label, detail: s.at ? ago(s.at) : null, state: s.at ? ("done" as const) : i === now ? ("now" as const) : ("todo" as const) }));
  };
  if (o.cancellation) {
    if (o.acceptedAt) steps.push({ key: "accepted", label: "The freelancer started", at: o.acceptedAt });
    const declined = o.cancellation.by === "vendor" && !o.acceptedAt;
    steps.push({ key: "cancelled", label: declined ? "Declined" : `Cancelled${byRuxstar(o.cancellation.by) ? " by Ruxstar" : ""}`, at: o.cancellation.at });
    return end();
  }
  steps.push({ key: "accepted", label: o.quoteId ? "The freelancer started" : "The freelancer accepted", at: o.acceptedAt });
  o.deliveries.forEach((d, i) => {
    steps.push({ key: `delivery-${d.id}`, label: i === 0 ? "Delivered" : `Delivered again (${i + 1})`, at: d.at });
    if (d.answer?.kind === "revision") steps.push({ key: `revision-${d.id}`, label: "Changes asked for", at: d.answer.at });
  });
  if (!o.deliveries.length) steps.push({ key: "delivery", label: "Delivered" });
  if (o.dispute) {
    steps.push({ key: "dispute", label: "Problem reported", at: o.dispute.openedAt });
    steps.push({ key: "decided", label: "Ruxstar decided", at: o.dispute.decision?.at });
    return end();
  }
  const completed = [...o.timeline].reverse().find((t) => t.status === "completed");
  steps.push({ key: "completed", label: completed?.by === "system" ? "Completed by itself" : "Completed", at: completed?.at ?? o.completedAt });
  return end();
}

/** "Basic · 3 days · 2 revisions" for an order's package, or "Custom offer · …". */
export function packageLine(o: Pick<GigOrder, "package" | "quoteId">): string {
  const name = o.quoteId ? "Custom offer" : o.package.name;
  return [name, daysText(o.package.deliveryDays), revisionsText(o.package.revisions)].join(" · ");
}

/** Under the badge on a list row or the order's head: the next deadline, in plain words. */
export function deadlineText(o: Pick<GigOrder, "status" | "acceptBy" | "dueAt" | "autoCompleteAt" | "payBy" | "late">, now: number = Date.now()): string | null {
  if (o.status === "awaiting_payment" && o.payBy) return timeLeftText(o.payBy, now) ? "Pay soon to keep this order" : null;
  if (o.status === "paid" && o.acceptBy) {
    const left = timeLeftText(o.acceptBy, now);
    return left ? `${left} to accept` : null;
  }
  if (o.status === "in_progress" && o.dueAt) {
    if (o.late) return "Past its due date";
    const left = timeLeftText(o.dueAt, now);
    return left ? `Due: ${left}` : null;
  }
  if (o.status === "delivered" && o.autoCompleteAt) {
    const left = timeLeftText(o.autoCompleteAt, now);
    return left ? `Completes by itself: ${left}` : null;
  }
  return null;
}

/** A category's label from the rules, or the key tidied up for one no longer shown. */
export const categoryLabel = (categories: readonly { key: string; label: string }[], key: string) =>
  categories.find((c) => c.key === key)?.label ?? key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/** "₹1,500 to ₹5,00,000" from the rules, for hints. */
export const priceRangeText = (min: number, max: number) => `${money(min)} to ${money(max)}`;

export const percentText = (bps: number) => `${bps / 100}%`;

/** "12 Mar 2026, 4:30 pm" in India. */
export const momentText = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

export const dayText = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

/** A file link that downloads instead of opening in the browser. */
export const downloadHref = (url: string) => `${url}${url.includes("?") ? "&" : "?"}download=1`;

// Files: set by Ruxstar in the console. GET /v1/gigs/rules sends them as `limits`.

/** Every file type the API can take, by extension. Ruxstar picks which of them are allowed. Same as the app. */
export const FILE_TYPES = [
  "pdf", "jpg", "jpeg", "png", "gif", "webp", "heic", "psd", "ai", "eps", "mp4", "mov", "webm", "mp3", "wav", "m4a",
  "zip", "txt", "csv", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "ttf", "otf",
] as const;

const MB = 1024 * 1024;
const extensionOf = (name: string) => /\.([a-z0-9]{2,5})$/i.exec(name.trim())?.[1]?.toLowerCase() ?? "";
export const allowedFile = (name: string, extensions: readonly string[]) => extensions.includes(extensionOf(name));

/** Why these picked files can't go with the ones already added, or null: a type the API refuses, too many, or more than `maxMb` in all. */
export function filesProblem(picked: readonly { name: string; size: number }[], held: readonly { bytes: number }[], maxMb: number, limits: Pick<GigsLimits, "files" | "extensions">): string | null {
  const refused = picked.find((f) => !allowedFile(f.name, limits.extensions));
  if (refused) return `${refused.name} can’t be sent. Use one of these: ${limits.extensions.join(", ")}.`;
  if (picked.length + held.length > limits.files) return `Up to ${limits.files} file${limits.files === 1 ? "" : "s"}.`;
  const bytes = picked.reduce((s, f) => s + f.size, 0) + held.reduce((s, f) => s + f.bytes, 0);
  if (bytes > maxMb * MB) return `Files can add up to ${maxMb} MB.`;
  return null;
}

// Forms. Same checks and words as the app.

type Errors = Record<string, string>;
type Limits = Pick<GigsRules, "minPrice" | "maxPrice" | "minDays" | "maxDays" | "maxRevisions">;

const length = (text: string, min: number, max: number, what: string): string | undefined => {
  const n = text.trim().length;
  if (n < min) return min === 1 ? `Add ${what}.` : `${what[0]!.toUpperCase()}${what.slice(1)} needs at least ${min} characters.`;
  if (n > max) return `Keep it to ${max} characters.`;
  return undefined;
};

const wholeNumber = (text: string): number | null => (/^\d+$/.test(text.trim()) ? Number(text.trim()) : null);
const rupeesText = (paise: number) => String(paise / 100);

/** "Logo design, branding , logo design" → ["Logo design", "branding"]: trimmed, no repeats ignoring case. */
export function splitList(text: string): string[] {
  const seen = new Map<string, string>();
  for (const raw of text.split(",")) {
    const item = raw.trim().replace(/\s+/g, " ");
    if (item && !seen.has(item.toLowerCase())) seen.set(item.toLowerCase(), item);
  }
  return [...seen.values()];
}

/** Rupees as typed: digits and one decimal point with up to two places. */
export const rupeeInput = (text: string) => text.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1").replace(/(\.\d{0,2}).*$/, "$1");

function termsErrors(t: { price: string; deliveryDays: string; revisions: string }, rules: Limits, prefix: string): Errors {
  const errors: Errors = {};
  const price = paiseOf(t.price);
  if (price === null || price < rules.minPrice || price > rules.maxPrice) errors[`${prefix}price`] = `From ${money(rules.minPrice)} to ${money(rules.maxPrice)}.`;
  const days = wholeNumber(t.deliveryDays);
  if (days === null || days < rules.minDays || days > rules.maxDays) errors[`${prefix}deliveryDays`] = `${rules.minDays} to ${rules.maxDays} days.`;
  const revisions = wholeNumber(t.revisions);
  if (revisions === null || revisions > rules.maxRevisions) errors[`${prefix}revisions`] = rules.maxRevisions ? `0 to ${rules.maxRevisions}.` : "Revisions are off for now: use 0.";
  return errors;
}

export interface ProfileDraft {
  name: string;
  headline: string;
  bio: string;
  category: string;
  skills: string;
  languages: string;
  city: string;
}

type ProfileFields = Pick<MyFreelancer, "name" | "headline" | "bio" | "category" | "skills" | "languages" | "city">;

export const emptyProfile = (name: string, category: string): ProfileDraft => ({ name, headline: "", bio: "", category, skills: "", languages: "English", city: "" });

export const profileDraftOf = (p: ProfileFields): ProfileDraft => ({
  name: p.name,
  headline: p.headline,
  bio: p.bio ?? "",
  category: p.category,
  skills: p.skills.join(", "),
  languages: p.languages.join(", "),
  city: p.city ?? "",
});

export function profileErrors(d: ProfileDraft): Errors {
  const errors: Errors = {};
  const name = length(d.name, 2, 60, "your name");
  if (name) errors.name = name;
  const headline = length(d.headline, 5, 80, "a headline");
  if (headline) errors.headline = headline;
  if (d.bio.trim().length > 500) errors.bio = "Keep it to 500 characters.";
  if (!d.category) errors.category = "Pick what you do.";
  const skills = splitList(d.skills);
  if (skills.length > 15) errors.skills = "Up to 15 skills.";
  else if (skills.some((s) => s.length < 2 || s.length > 30)) errors.skills = "Each skill is 2 to 30 characters.";
  const languages = splitList(d.languages);
  if (!languages.length) errors.languages = "Add at least one language.";
  else if (languages.length > 8) errors.languages = "Up to 8 languages.";
  else if (languages.some((s) => s.length < 2 || s.length > 30)) errors.languages = "Each language is 2 to 30 characters.";
  if (d.city.trim() && (d.city.trim().length < 2 || d.city.trim().length > 60)) errors.city = "Use 2 to 60 characters, or leave it empty.";
  return errors;
}

export const toProfileInput = (d: ProfileDraft): FreelancerInput => ({
  name: d.name.trim(),
  headline: d.headline.trim(),
  bio: d.bio.trim() || null,
  category: d.category,
  skills: splitList(d.skills),
  languages: splitList(d.languages),
  city: d.city.trim() || null,
});

/** Only what changed, for PATCH /v1/gigs/me; empty when nothing did. */
export function profileChanges(d: ProfileDraft, before: ProfileFields): FreelancerPatch {
  const next = toProfileInput(d);
  const changes: FreelancerPatch = {};
  if (next.name !== before.name) changes.name = next.name;
  if (next.headline !== before.headline) changes.headline = next.headline;
  if (next.bio !== before.bio) changes.bio = next.bio;
  if (next.category !== before.category) changes.category = next.category;
  if (next.skills.join("\n") !== before.skills.join("\n")) changes.skills = next.skills;
  if (next.languages.join("\n") !== before.languages.join("\n")) changes.languages = next.languages;
  if (next.city !== before.city) changes.city = next.city;
  return changes;
}

export function linkErrors(title: string, url: string): Errors {
  const errors: Errors = {};
  const t = length(title, 2, 80, "a title");
  if (t) errors.title = t;
  if (!/^https?:\/\/\S+\.\S+/.test(url.trim())) errors.url = "Paste a full link starting with https://";
  else if (url.trim().length > 500) errors.url = "That link is too long.";
  return errors;
}

export interface PackageDraft {
  tier: GigTier;
  name: string;
  description: string;
  price: string;
  deliveryDays: string;
  revisions: string;
}

export interface QuestionDraft {
  key: string;
  text: string;
  required: boolean;
}

export interface GigDraft {
  title: string;
  category: string;
  description: string;
  packages: PackageDraft[];
  questions: QuestionDraft[];
}

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

export const emptyPackage = (tier: GigTier, rules: Limits): PackageDraft => ({
  tier,
  name: "",
  description: "",
  price: "",
  deliveryDays: String(clamp(3, rules.minDays, rules.maxDays)),
  revisions: String(clamp(1, 0, rules.maxRevisions)),
});

export const emptyGig = (category: string, rules: Limits): GigDraft => ({ title: "", category, description: "", packages: [emptyPackage("basic", rules)], questions: [] });

let questionKeys = 0;
export const newQuestion = (): QuestionDraft => ({ key: `q${(questionKeys += 1)}`, text: "", required: true });

export const gigDraftOf = (g: Pick<MyGig, "title" | "category" | "description" | "packages" | "questions">): GigDraft => ({
  title: g.title,
  category: g.category,
  description: g.description,
  packages: sortedPackages(g.packages).map((p) => ({
    tier: p.tier,
    name: p.name === TIER_LABEL[p.tier] ? "" : p.name,
    description: p.description,
    price: rupeesText(p.price),
    deliveryDays: String(p.deliveryDays),
    revisions: String(p.revisions),
  })),
  questions: g.questions.map((q) => ({ key: q.id, text: q.text, required: q.required })),
});

/** The next tier, while Ruxstar allows more packages. */
export const nextTier = (d: Pick<GigDraft, "packages">, maxPackages: number): GigTier | null =>
  d.packages.length < Math.min(maxPackages, TIERS.length) ? TIERS[d.packages.length]! : null;

export function gigErrors(d: GigDraft, rules: Limits & Pick<GigsRules, "maxPackages">): Errors {
  const errors: Errors = {};
  const title = length(d.title, 10, 80, "the title");
  if (title) errors.title = title;
  if (!d.category) errors.category = "Pick a category.";
  const description = length(d.description, 30, 3000, "the description");
  if (description) errors.description = description;
  if (!d.packages.length) errors.packages = "Add a package.";
  if (d.packages.length > rules.maxPackages) errors.packages = `Up to ${plural(rules.maxPackages, "package")}.`;
  d.packages.forEach((p) => {
    const prefix = `${p.tier}.`;
    if (p.name.trim() && (p.name.trim().length < 2 || p.name.trim().length > 40)) errors[`${prefix}name`] = "Use 2 to 40 characters, or leave it empty.";
    const what = length(p.description, 10, 600, "what’s included");
    if (what) errors[`${prefix}description`] = what;
    Object.assign(errors, termsErrors(p, rules, prefix));
  });
  d.questions.forEach((q) => {
    const text = length(q.text, 3, 200, "the question");
    if (text) errors[`q.${q.key}`] = text;
  });
  return errors;
}

export type GigStep = "about" | "packages" | "questions";
export const GIG_STEPS: { key: GigStep; label: string }[] = [
  { key: "about", label: "About" },
  { key: "packages", label: "Packages" },
  { key: "questions", label: "Questions" },
];

/** Which step of the gig editor holds the first problem, so the editor can go back to it. */
export function stepOfError(errors: Errors): GigStep | null {
  const keys = Object.keys(errors);
  if (keys.some((k) => k === "title" || k === "category" || k === "description")) return "about";
  if (keys.some((k) => k === "packages" || TIERS.some((t) => k.startsWith(`${t}.`)))) return "packages";
  if (keys.some((k) => k.startsWith("q."))) return "questions";
  return null;
}

export const toGigInput = (d: GigDraft): GigInput => ({
  title: d.title.trim(),
  category: d.category,
  description: d.description.trim(),
  packages: d.packages.map((p) => ({
    tier: p.tier,
    ...(p.name.trim() ? { name: p.name.trim() } : {}),
    description: p.description.trim(),
    price: paiseOf(p.price) ?? 0,
    deliveryDays: Number(p.deliveryDays),
    revisions: Number(p.revisions),
  })),
  questions: d.questions.map((q) => ({ text: q.text.trim(), required: q.required })),
});

export interface QuoteDraft {
  title: string;
  description: string;
  category: string;
  price: string;
  deliveryDays: string;
  revisions: string;
}

export function emptyQuote(category: string, rules: Limits): QuoteDraft {
  const { deliveryDays, revisions } = emptyPackage("basic", rules);
  return { title: "", description: "", category, price: "", deliveryDays, revisions };
}

export function quoteErrors(d: QuoteDraft, rules: Limits): Errors {
  const errors: Errors = {};
  const title = length(d.title, 3, 80, "a title");
  if (title) errors.title = title;
  const description = length(d.description, 10, 1200, "what’s included");
  if (description) errors.description = description;
  if (!d.category) errors.category = "Pick a category.";
  return { ...errors, ...termsErrors(d, rules, "") };
}

export const toQuoteInput = (d: QuoteDraft): QuoteInput => ({
  title: d.title.trim(),
  description: d.description.trim(),
  category: d.category,
  price: paiseOf(d.price) ?? 0,
  deliveryDays: Number(d.deliveryDays),
  revisions: Number(d.revisions),
});

/** Links typed one per line or with spaces between them. */
export const linesOf = (text: string) => [...new Set(text.split(/\s+/).map((l) => l.trim()).filter(Boolean))];

export function deliveryErrors(message: string, links: readonly string[], maxLinks: number): Errors {
  const errors: Errors = {};
  if (!message.trim()) errors.message = "Tell the customer what you’re sending.";
  else if (message.trim().length > 2000) errors.message = "Keep it to 2000 characters.";
  if (links.length > maxLinks) errors.links = `Up to ${plural(maxLinks, "link")}.`;
  else if (links.some((l) => !/^https?:\/\/\S+\.\S+/.test(l) || l.length > 500)) errors.links = "Each link starts with https://";
  return errors;
}

// The console's categories.

const CATEGORY_KEY = /^[a-z][a-z0-9_]{1,29}$/;
export const MAX_CATEGORIES = 30;

/** A new category's key from its label, like "Voice overs" → "voice_overs"; a number is added when it's taken. */
export function categoryKeyOf(label: string, taken: readonly string[]): string {
  let base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^[^a-z]+/, "")
    .replace(/_+$/, "")
    .slice(0, 26);
  if (base.length < 2) base = "category";
  let key = base;
  for (let n = 2; taken.includes(key); n += 1) key = `${base}_${n}`;
  return key;
}

/** What's wrong with the list, as the API would say it, or null. */
export function categoriesProblem(list: readonly GigCategory[]): string | null {
  if (!list.length) return "Add at least one category.";
  if (list.length > MAX_CATEGORIES) return `Up to ${MAX_CATEGORIES} categories.`;
  if (list.some((c) => !c.label.trim() || c.label.trim().length > 40)) return "Each category needs a name of up to 40 characters.";
  if (list.some((c) => !CATEGORY_KEY.test(c.key))) return "A category’s key isn’t valid.";
  if (new Set(list.map((c) => c.key)).size !== list.length) return "Each category needs its own key.";
  if (list.every((c) => c.hidden)) return "Keep at least one category showing.";
  return null;
}

/** Whether the list differs from the saved one: a label, a hidden switch, the order, or a new category. */
export const categoriesChanged = (list: readonly GigCategory[], saved: readonly GigCategory[]) =>
  list.length !== saved.length || list.some((c, i) => c.key !== saved[i]?.key || c.label.trim() !== saved[i]?.label || c.hidden !== saved[i]?.hidden);
