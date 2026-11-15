/**
 * Coaching's API shapes, named so screens can share the small pieces (slots, students, classes). The block at the end
 * fails type-checking if any of them drifts from the generated `schema.d.ts`.
 * Amounts are paise; times are ISO strings; days are India's `YYYY-MM-DD`.
 */

import type { InvoiceRef } from "./invoices";
import type { paths } from "./schema";

export type CourseCategory = "tuition" | "exam_prep" | "music" | "dance" | "sports" | "fitness" | "art" | "languages" | "tech" | "other";
export type CourseMode = "offline" | "online";
export type CourseStatus = "draft" | "live" | "removed";
export type BatchStatus = "open" | "full" | "started" | "ended" | "cancelled";
export type CoachingOrderStatus = "awaiting_payment" | "confirmed" | "cancelled";
/** batch: an enrolment. demo: one trial class. */
export type CoachingKind = "batch" | "demo";
export type ClassStatus = "upcoming" | "done" | "cancelled";

export type Photo = { url: string; width: number; height: number } | null;
export interface Venue {
  name: string;
  address: string;
  city: string;
  point: { lat: number; lng: number } | null;
}
/** One weekly class time: 0 Sunday … 6 Saturday, HH:MM in India in 15-minute steps. */
export interface Slot {
  day: number;
  start: string;
  minutes: number;
}
export interface Coach {
  id: string;
  name: string;
}
/** `childId` null: the account holder. */
export interface Student {
  childId: string | null;
  name: string;
}

export interface CoachingRules {
  certificatePercent: number;
  minimumHours: number;
  maxBatchSize: number;
  maxClasses: number;
  maxBatches: number;
  maxDemoFee: number;
  maxDemoSeats: number;
  joinMinutes: number;
  commissionBps: number;
  platformFee: number;
}

/** What the console edits on the coaching module. */
export type CoachingModuleRules = Omit<CoachingRules, "commissionBps" | "platformFee">;

export interface CourseCard {
  id: string;
  title: string;
  category: CourseCategory;
  mode: CourseMode;
  business: { id: string; name: string };
  photo: Photo;
  city: string | null;
  venueName: string | null;
  /** The lowest fee of a batch open for enrolment. */
  feeFrom: number | null;
  openBatches: number;
  nextStart: string | null;
  demo: { fee: number; free: boolean } | null;
}

export interface CourseFilters {
  q?: string;
  category?: CourseCategory;
  online?: boolean;
  city?: string;
}

export interface BatchView {
  id: string;
  name: string;
  fee: number;
  capacity: number;
  seatsLeft: number;
  slots: Slot[];
  /** In words, for example "Mon, Wed 5–6 pm". */
  schedule: string;
  startDate: string;
  firstAt: string;
  lastEndsAt: string;
  classes: number;
  minStudents: number | null;
  enrolled: number;
  coaches: Coach[];
  status: BatchStatus;
  cancelReason: string | null;
}

export interface DemoClass {
  sessionId: string;
  batchId: string;
  batchName: string;
  startsAt: string;
  endsAt: string;
  seatsLeft: number;
}

export interface CourseDetail extends CourseCard {
  description: string | null;
  venue: Venue | null;
  certificatePercent: number;
  batches: BatchView[];
  demoClasses: DemoClass[];
  refundRule: string;
  platformFee: number;
  status: CourseStatus;
  canEnrol: boolean;
  whyNot: string | null;
  myOrders: { id: string; orderNo: number; kind: CoachingKind; status: CoachingOrderStatus; student: Student; batchId: string }[];
  /** Students who have had, or booked, this course's demo. */
  demoTaken: Student[];
  /** The institute's rating across all its reviews; `average` is null until there are 3. */
  rating?: { average: number | null; count: number };
}

export interface ClassView {
  id: string;
  startsAt: string;
  endsAt: string;
  status: ClassStatus;
  extra: boolean;
  movedFrom: string | null;
  cancelReason: string | null;
  attendance: "present" | "absent" | null;
  /** Online classes: shown from `joinFrom` until the class ends. */
  joinLink: string | null;
  joinFrom: string | null;
}

export interface CertificateRef {
  id: string;
  code: string;
  issuedAt: string;
  /** Works for 10 minutes without signing in. */
  pdfUrl: string;
}

export interface AppliedCoupon {
  code: string;
  fundedBy: "ruxstar" | "vendor";
  /** "Ruxstar offer" or "Shop offer". */
  label: string;
}

export interface CoachingOrder {
  id: string;
  orderNo: number;
  kind: CoachingKind;
  status: CoachingOrderStatus;
  student: Student;
  course: {
    id: string;
    title: string;
    category: CourseCategory;
    mode: CourseMode;
    photo: Photo;
    venueName: string | null;
    address: string | null;
    city: string | null;
    removed: boolean;
  };
  batch: { id: string; name: string; schedule: string; firstAt: string; lastEndsAt: string; cancelled: boolean; cancelReason: string | null };
  business: { id: string; name: string };
  price: { items: number; discount: number; platformFee: number; total: number };
  coupon: AppliedCoupon | null;
  refund: { amount: number; status: "pending" | "done"; reason: string | null } | null;
  reason: string | null;
  canCancel: boolean;
  /** Cancel before this, the first class, for a full refund. */
  cancelUntil: string | null;
  /** Unpaid, the seat goes back after this. */
  payBy: string | null;
  classes: ClassView[];
  attendance: { attended: number; held: number; percent: number; needed: number };
  certificate: CertificateRef | null;
  invoices?: InvoiceRef[];
  /** Open for a review now: once the first class it covers is held, until 30 days after the last. */
  canReview?: boolean;
  /** The last moment to write or change the review; null when it can't be reviewed now. */
  reviewUntil?: string | null;
  createdAt: string;
}

export interface Placed {
  order: CoachingOrder;
  /** Null when it was free and is confirmed already. */
  checkoutUrl: string | null;
}

export type MyClassesView = "current" | "past";

export interface TimetableRow {
  orderId: string;
  kind: CoachingKind;
  student: Student;
  course: { id: string; title: string; mode: CourseMode };
  batchName: string;
  business: string;
  class: ClassView;
}

export interface Material {
  id: string;
  title: string;
  kind: "file" | "link";
  /** The link, or for a file a signed link that works for 10 minutes. */
  url: string;
  fileName: string | null;
  contentType: string | null;
  bytes: number | null;
  wholeCourse: boolean;
  addedAt: string;
}

export interface Message {
  id: string;
  text: string;
  author: string;
  at: string;
}

export interface Child {
  id: string;
  name: string;
  birthYear: number | null;
  /** Open enrolments and demos; a child with any can't be removed. */
  enrolments: number;
}

export interface Certificate extends CertificateRef {
  orderId: string;
  studentName: string;
  courseTitle: string;
  batchName: string;
  businessName: string;
  attended: number;
  classes: number;
}

export interface CouponOffer {
  code: string;
  fundedBy: "ruxstar" | "vendor";
  label: string;
  terms: string | null;
  /** Paise it takes off this fee; 0 when it doesn't apply yet. */
  discount: number;
  problem: string | null;
}

export interface Offers {
  offers: CouponOffer[];
  checked: { code: string; discount: number; problem: string | null } | null;
}

// The institute's side.

export interface CourseInput {
  title: string;
  description: string | null;
  category: CourseCategory;
  mode: CourseMode;
  venue: { name: string; address: string; city: string } | null;
  demo: { fee: number; seats: number } | null;
  certificatePercent?: number;
}
export type CoursePatch = Partial<CourseInput>;

export interface BatchInput {
  name: string;
  fee: number;
  capacity: number;
  minStudents: number | null;
  slots: Slot[];
  startDate: string;
  classes: number | null;
  endDate: string | null;
  onlineLink: string | null;
  coachIds: string[];
}
export type BatchPatch = Partial<BatchInput>;

export interface VendorBatch extends BatchView {
  /** Seats waiting for a payment. */
  held: number;
  onlineLink: string | null;
  coachIds: string[];
  minimumBy: string | null;
  certificatesAt: string | null;
  sales: number;
}

export interface VendorCourse extends CourseCard {
  description: string | null;
  venue: Venue | null;
  demoSeats: number | null;
  certificatePercent: number;
  status: CourseStatus;
  publishedAt: string | null;
  removal: { reason: string; at: string } | null;
  batches: VendorBatch[];
  counts: { students: number; demos: number };
  money: { sales: number; share: number; commissionBps: number };
  missing: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StudentRow {
  id: string;
  orderNo: number;
  kind: CoachingKind;
  status: CoachingOrderStatus;
  student: { name: string; child: boolean };
  parent: { id: string; name: string; phone: string | null };
  batch: { id: string; name: string };
  demoAt: string | null;
  total: number;
  share: number;
  refunded: number;
  attendance: { attended: number; held: number };
  createdAt: string;
}
export interface StudentsFilter {
  batchId?: string;
  kind?: CoachingKind;
  status?: "confirmed" | "cancelled";
}

// Classes, for the owner and coaches.

export interface DeskCan {
  attendance: boolean;
  message: boolean;
  materials: boolean;
  reschedule: boolean;
}
export interface DeskClass {
  id: string;
  startsAt: string;
  endsAt: string;
  status: ClassStatus;
  extra: boolean;
  movedFrom: string | null;
  cancelReason: string | null;
  demos: number;
  /** Attendance saved. */
  marked: boolean;
  present: number;
}
export interface DeskBatch {
  id: string;
  name: string;
  course: { id: string; title: string; mode: CourseMode };
  business: { id: string; name: string };
  schedule: string;
  slots: Slot[];
  firstAt: string;
  lastEndsAt: string;
  status: BatchStatus;
  onlineLink: string | null;
  students: number;
  nextClass: DeskClass | null;
  role: "owner" | "coach";
  can: DeskCan;
}
export interface DeskBatchDetail extends DeskBatch {
  classes: DeskClass[];
}
export interface TodayClass extends DeskClass {
  batch: { id: string; name: string };
  course: { id: string; title: string };
  students: number;
}
export interface RosterStudent {
  orderId: string;
  name: string;
  kind: CoachingKind;
  child: boolean;
  /** Null: not marked. */
  present: boolean | null;
}
export interface Roster {
  class: DeskClass;
  batch: { id: string; name: string };
  /** Attendance opens 30 minutes before the class and closes when certificates are issued. */
  canMark: boolean;
  students: RosterStudent[];
}
export interface DeskStudent {
  orderId: string;
  name: string;
  child: boolean;
  attended: number;
  held: number;
  percent: number;
  certificateAt: number;
}

export type StaffCourseStatus = CourseStatus;

type Ok<R> = R extends { responses: infer Rs } ? Rs[keyof Rs & (200 | 201)] : never;
type Data<R> = Ok<R> extends { content: { "application/json": { data: infer D } } } ? D : never;
type Body<R> = R extends { requestBody?: { content: { "application/json": infer B } } } ? B : never;
type Item<T> = T extends readonly (infer I)[] ? I : T;
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;

/** Each line stops compiling when the backend changes that shape; `npm run api:types` then shows what moved. */
export type ContractChecks = [
  Assert<Same<CoachingRules, Data<paths["/v1/coaching/rules"]["get"]>>>,
  Assert<Same<CourseCard, Item<Data<paths["/v1/coaching/"]["get"]>>>>,
  Assert<Same<CourseDetail, Data<paths["/v1/coaching/{id}"]["get"]>>>,
  Assert<Same<Offers, Data<paths["/v1/coaching/batches/{id}/offers"]["get"]>>>,
  Assert<Same<Placed, Data<paths["/v1/coaching/batches/{id}/enrol"]["post"]>>>,
  Assert<Same<Placed, Data<paths["/v1/coaching/{id}/demo"]["post"]>>>,
  Assert<Same<CoachingOrder, Data<paths["/v1/coaching/orders/{id}"]["get"]>>>,
  Assert<Same<CoachingOrder, Item<Data<paths["/v1/coaching/orders"]["get"]>>>>,
  Assert<Same<Material, Item<Data<paths["/v1/coaching/orders/{id}/materials"]["get"]>>>>,
  Assert<Same<Message, Item<Data<paths["/v1/coaching/orders/{id}/messages"]["get"]>>>>,
  Assert<Same<TimetableRow, Item<Data<paths["/v1/coaching/timetable"]["get"]>>>>,
  Assert<Same<Certificate, Item<Data<paths["/v1/coaching/certificates"]["get"]>>>>,
  Assert<Same<Child, Item<Data<paths["/v1/coaching/children"]["get"]>>>>,
  Assert<Same<VendorCourse, Data<paths["/v1/vendor/courses/{id}"]["get"]>>>,
  Assert<Same<VendorCourse, Data<paths["/v1/ruxstar/coaching/courses/{id}"]["get"]>>>,
  Assert<Same<StudentRow, Item<Data<paths["/v1/vendor/courses/{id}/students"]["get"]>>>>,
  Assert<Same<CourseInput, Body<paths["/v1/vendor/businesses/{id}/courses"]["post"]>>>,
  Assert<Same<BatchInput, Body<paths["/v1/vendor/courses/{id}/batches"]["post"]>>>,
  Assert<Same<DeskBatch, Item<Data<paths["/v1/coaching/desk/batches"]["get"]>>>>,
  Assert<Same<DeskBatchDetail, Data<paths["/v1/coaching/desk/batches/{id}"]["get"]>>>,
  Assert<Same<TodayClass, Item<Data<paths["/v1/coaching/desk/today"]["get"]>>>>,
  Assert<Same<Roster, Data<paths["/v1/coaching/desk/classes/{id}"]["get"]>>>,
  Assert<Same<DeskStudent, Item<Data<paths["/v1/coaching/desk/batches/{id}/students"]["get"]>>>>,
  Assert<Same<Child, Data<paths["/v1/coaching/children/{id}"]["patch"]>>>,
  Assert<Same<{ checkoutUrl: string }, Data<paths["/v1/coaching/orders/{id}/pay"]["post"]>>>,
  Assert<Same<VendorCourse, Data<paths["/v1/vendor/courses/{id}/publish"]["post"]>>>,
  Assert<Same<VendorCourse, Data<paths["/v1/vendor/courses/{id}/photo"]["post"]>>>,
  Assert<Same<VendorCourse, Data<paths["/v1/vendor/courses/{id}/batches"]["post"]>>>,
  Assert<Same<VendorCourse, Data<paths["/v1/vendor/batches/{id}"]["patch"]>>>,
  Assert<Same<VendorCourse, Data<paths["/v1/vendor/batches/{id}"]["delete"]>>>,
  Assert<Same<VendorCourse, Data<paths["/v1/vendor/batches/{id}/cancel"]["post"]>>>,
  Assert<Same<VendorCourse, Data<paths["/v1/ruxstar/coaching/courses/{id}/take-down"]["post"]>>>,
  Assert<Same<Roster, Data<paths["/v1/coaching/desk/classes/{id}/attendance"]["put"]>>>,
  Assert<Same<DeskBatchDetail, Data<paths["/v1/coaching/desk/classes/{id}/cancel"]["post"]>>>,
  Assert<Same<DeskBatchDetail, Data<paths["/v1/coaching/desk/classes/{id}/move"]["post"]>>>,
  Assert<Same<DeskBatchDetail, Data<paths["/v1/coaching/desk/batches/{id}/classes"]["post"]>>>,
  Assert<Same<Message, Data<paths["/v1/coaching/desk/batches/{id}/messages"]["post"]>>>,
  Assert<Same<Material, Data<paths["/v1/coaching/desk/batches/{id}/materials"]["post"]>>>,
  Assert<Same<Material, Data<paths["/v1/coaching/desk/batches/{id}/materials/file"]["post"]>>>,
];
