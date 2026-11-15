import type { TagTone } from "@/components/ui";
import type {
  BatchStatus,
  CoachingKind,
  CoachingOrderStatus,
  CourseCard,
  CourseCategory,
  CourseMode,
  CourseStatus,
  DeskClass,
  Slot,
  Student,
} from "@/lib/api/coaching";
import { money } from "@/lib/api/shops";

export const CATEGORY_LABEL: Record<CourseCategory, string> = {
  tuition: "Tuition",
  exam_prep: "Exam prep",
  music: "Music",
  dance: "Dance",
  sports: "Sports",
  fitness: "Fitness & yoga",
  art: "Art & craft",
  languages: "Languages",
  tech: "Coding & tech",
  other: "Other",
};
export const CATEGORIES = Object.keys(CATEGORY_LABEL) as CourseCategory[];

export const MODE_LABEL: Record<CourseMode, string> = { offline: "In person", online: "Online" };

export const ORDER_STATUS: Record<CoachingOrderStatus, { label: string; tone: TagTone }> = {
  awaiting_payment: { label: "Not paid yet", tone: "warning" },
  confirmed: { label: "Confirmed", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export const KIND_LABEL: Record<CoachingKind, string> = { batch: "Enrolment", demo: "Demo class" };

export const BATCH_STATUS: Record<BatchStatus, { label: string; tone: TagTone }> = {
  open: { label: "Taking students", tone: "success" },
  full: { label: "Full", tone: "warning" },
  started: { label: "Running", tone: "neutral" },
  ended: { label: "Ended", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

export const COURSE_STATUS: Record<CourseStatus, { label: string; tone: TagTone }> = {
  draft: { label: "Draft", tone: "warning" },
  live: { label: "Live", tone: "success" },
  removed: { label: "Taken down", tone: "danger" },
};

const titleCase = (city: string) => city.replace(/\b\w/g, (c) => c.toUpperCase());

/** "Online", or the venue and city. */
export const placeLine = (course: Pick<CourseCard, "mode" | "venueName" | "city">) =>
  course.mode === "online" ? "Online" : [course.venueName, course.city ? titleCase(course.city) : null].filter(Boolean).join(", ") || "In person";

/** "From ₹4,000", "Free", or that no batch is open. */
export function feeLine(course: Pick<CourseCard, "feeFrom">): string {
  if (course.feeFrom === null) return "No batches open";
  return course.feeFrom === 0 ? "Free" : `From ${money(course.feeFrom)}`;
}

/** "Free demo class", "Demo class ₹200", or null. */
export const demoLine = (course: Pick<CourseCard, "demo">) =>
  course.demo ? (course.demo.free ? "Free demo class" : `Demo class ${money(course.demo.fee)}`) : null;

/** "Free" or the fee. */
export const feeText = (paise: number) => (paise === 0 ? "Free" : money(paise));

/** The student's name, marked when it's the account holder. */
export const studentName = (student: Student) => (student.childId ? student.name : `${student.name} (you)`);

// Weekly schedules.

/** Monday first, as the week reads in India. 0 is Sunday, as the API counts. */
export const WEEK = [1, 2, 3, 4, 5, 6, 0] as const;
export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const pad = (n: number) => String(n).padStart(2, "0");
export const minutesOf = (start: string) => Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5));
export const startOf = (minutes: number) => `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;

/** "5 pm", "5:30 pm". */
export function clockText(start: string): string {
  const total = minutesOf(start);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${h % 12 || 12}${m ? `:${pad(m)}` : ""} ${h < 12 ? "am" : "pm"}`;
}

/** "1 hr", "45 min", "1 hr 30 min". */
export function lengthText(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h ? `${h} hr` : "", m ? `${m} min` : ""].filter(Boolean).join(" ");
}

/** For example "Mon, Wed 5–6 pm · Sat 10–11:30 am", like the API's own text. */
export function scheduleText(slots: Slot[]): string {
  const groups = new Map<string, number[]>();
  for (const slot of [...slots].sort((a, b) => ((a.day + 6) % 7) - ((b.day + 6) % 7) || a.start.localeCompare(b.start))) {
    const key = `${slot.start}|${slot.minutes}`;
    groups.set(key, [...(groups.get(key) ?? []), slot.day]);
  }
  return [...groups.entries()]
    .map(([key, days]) => {
      const [start, minutes] = key.split("|") as [string, string];
      return `${days.map((d) => DAY_SHORT[d]).join(", ")} ${clockText(start)}–${clockText(startOf(minutesOf(start) + Number(minutes)))}`;
    })
    .join(" · ");
}

/** The index of a slot that overlaps an earlier one on the same day, if any. */
export function slotClash(slots: Slot[]): number | null {
  for (let i = 0; i < slots.length; i++) {
    for (let j = 0; j < i; j++) {
      const a = slots[i]!;
      const b = slots[j]!;
      if (a.day !== b.day) continue;
      const [as, bs] = [minutesOf(a.start), minutesOf(b.start)];
      if (as < bs + b.minutes && bs < as + a.minutes) return i;
    }
  }
  return null;
}

const DAY_MS = 24 * 60 * 60_000;
export const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
export const weekdayOf = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay();
/** The Monday on or before `day`. */
export const mondayOf = (day: string) => addDays(day, -((weekdayOf(day) + 6) % 7));

/**
 * How many classes a weekly schedule gives and the first and last day, the way the API plans them: from the start date
 * for `classes` classes, or until `endDate`. Stops counting past `max`.
 */
export function planPreview(plan: { slots: Slot[]; startDate: string; classes: number | null; endDate: string | null }, max: number) {
  const want = plan.classes ?? max + 1;
  const days = new Set(plan.slots.map((s) => s.day));
  if (!days.size || !plan.startDate) return { count: 0, first: null as string | null, last: null as string | null };
  let count = 0;
  let first: string | null = null;
  let last: string | null = null;
  for (let i = 0, day = plan.startDate; i <= 732 && count < want; i++, day = addDays(day, 1)) {
    if (plan.endDate && day > plan.endDate) break;
    const n = plan.slots.filter((s) => s.day === weekdayOf(day)).length;
    if (!n) continue;
    first ??= day;
    last = day;
    count += Math.min(n, want - count);
  }
  return { count, first, last };
}

/** "2.4 MB", "640 KB". */
export function sizeText(bytes: number | null): string | null {
  if (bytes === null) return null;
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Attendance opens this long before a class. */
export const MARK_EARLY_MS = 30 * 60_000;

/** Where a class's attendance stands, in a few words, as the app says it. */
export function markLine(cls: Pick<DeskClass, "status" | "marked" | "present" | "startsAt" | "endsAt">, now: number): { text: string; tone: TagTone } {
  if (cls.status === "cancelled") return { text: "Cancelled", tone: "danger" };
  if (cls.marked) return { text: `Attendance saved · ${cls.present} present`, tone: "success" };
  if (Date.parse(cls.startsAt) - MARK_EARLY_MS > now) return { text: "Attendance opens 30 min before", tone: "neutral" };
  if (Date.parse(cls.endsAt) <= now) return { text: "Attendance not taken yet", tone: "warning" };
  return { text: "Take attendance", tone: "solid" };
}

/** "6 of 8 classes · 75%". */
export const attendanceLine = (a: { attended: number; held: number; percent?: number }) =>
  a.held ? `${a.attended} of ${a.held} ${a.held === 1 ? "class" : "classes"} · ${a.percent ?? Math.round((a.attended * 100) / a.held)}%` : "No classes yet";
