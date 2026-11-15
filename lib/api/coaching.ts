import { signedIn } from "./account";
import { API_URL, ApiError, type ApiErrorBody } from "./client";
import type { Page } from "./social";
import type {
  BatchInput,
  BatchPatch,
  Certificate,
  Child,
  CoachingOrder,
  CoachingRules,
  CourseCard,
  CourseDetail,
  CourseFilters,
  CourseInput,
  CoursePatch,
  DeskBatch,
  DeskBatchDetail,
  DeskStudent,
  Material,
  Message,
  MyClassesView,
  Offers,
  Placed,
  Roster,
  StaffCourseStatus,
  StudentRow,
  StudentsFilter,
  TimetableRow,
  TodayClass,
  VendorCourse,
} from "./coaching-types";

export type * from "./coaching-types";

type Query = Record<string, string | number | boolean | undefined>;
interface Call {
  query?: Query;
  body?: unknown;
  /** The raw file, sent as its own content type. */
  file?: Blob;
  key?: string;
}

/**
 * A small typed fetch with the same headers, cookies and errors as `api`, which also sends raw files (photos,
 * materials). `coaching-types.ts` checks every shape used here against the generated schema.
 */
async function call<T>(method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE", path: string, { query, body, file, key }: Call = {}): Promise<T> {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(query ?? {})) if (value !== undefined && value !== "") search.set(name, String(value));
  const headers: Record<string, string> = { "X-Client": "web" };
  if (key) headers["Idempotency-Key"] = key;
  if (file) headers["Content-Type"] = file.type;
  else if (body !== undefined) headers["Content-Type"] = "application/json";
  const qs = search.toString();
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}${qs ? `?${qs}` : ""}`, {
      method,
      credentials: "include",
      headers,
      body: file ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch {
    throw new ApiError(0, "NETWORK", "You seem to be offline. Check your connection and try again.");
  }
  const parsed = (await response.json().catch(() => null)) as (T & { error?: ApiErrorBody }) | null;
  const requestId = response.headers.get("x-request-id");
  if (response.ok && parsed) return parsed;
  if (parsed?.error) throw new ApiError(response.status, parsed.error.code, parsed.error.message, parsed.error.details, requestId);
  throw new ApiError(response.status, "INTERNAL", "Something went wrong on our side.", [], requestId);
}

const one = async <T>(method: Parameters<typeof call>[0], path: string, options?: Call) =>
  (await signedIn(() => call<{ data: T }>(method, path, options))).data;
const list = async <T>(path: string, query?: Query): Promise<Page<T>> => {
  const envelope = await signedIn(() => call<{ data: T[]; meta: { nextCursor?: string | null } }>("GET", path, { query }));
  return { items: envelope.data, nextCursor: envelope.meta?.nextCursor ?? null };
};
const enc = encodeURIComponent;

// Finding courses, demos and enrolling.

export const coachingRules = () => one<CoachingRules>("GET", "/v1/coaching/rules");

export const listCourses = (filters: CourseFilters, cursor?: string) => list<CourseCard>("/v1/coaching/", { ...filters, cursor });

/** With seats left right now, the demo classes, and the signed-in person's own enrolments in it. */
export const getCourse = (id: string) => one<CourseDetail>("GET", `/v1/coaching/${enc(id)}`);

export type PublicCourse = Omit<CourseDetail, "myOrders" | "demoTaken">;

/**
 * For the server: the course without anyone's enrolments, cached for a minute. Null when it isn't there or the API
 * only answers people who are signed in; the page then loads it in the browser instead.
 */
export async function fetchPublicCourse(id: string): Promise<PublicCourse | null> {
  if (!/^[a-f0-9]{24}$/.test(id)) return null;
  try {
    const res = await fetch(`${API_URL}/v1/coaching/${id}`, { headers: { "X-Client": "web" }, next: { revalidate: 60 } });
    if (!res.ok) return null;
    const { myOrders: _orders, demoTaken: _demos, ...course } = ((await res.json()) as { data: CourseDetail }).data;
    return course;
  } catch {
    return null;
  }
}

export const batchOffers = (batchId: string, code?: string) => one<Offers>("GET", `/v1/coaching/batches/${enc(batchId)}/offers`, { query: { code } });

/** Free batches come back confirmed with no checkout link. Pass the same key when retrying the same click. */
export const enrol = (batchId: string, body: { student: { childId: string | null }; coupon?: string; returnTo: string }, key: string) =>
  one<Placed>("POST", `/v1/coaching/batches/${enc(batchId)}/enrol`, { body, key });

export const bookDemo = (courseId: string, body: { sessionId: string; student: { childId: string | null }; returnTo: string }, key: string) =>
  one<Placed>("POST", `/v1/coaching/${enc(courseId)}/demo`, { body, key });

// Your classes.

export const myEnrolments = (view: MyClassesView, cursor?: string) => list<CoachingOrder>("/v1/coaching/orders", { view, cursor });

/** While it waits for payment, the API asks Cashfree whether it was paid. */
export const getEnrolment = (id: string) => one<CoachingOrder>("GET", `/v1/coaching/orders/${enc(id)}`);

export const payEnrolment = (id: string, returnTo: string) => one<{ checkoutUrl: string }>("POST", `/v1/coaching/orders/${enc(id)}/pay`, { body: { returnTo } });

export const cancelEnrolment = (id: string, key: string) => one<CoachingOrder>("POST", `/v1/coaching/orders/${enc(id)}/cancel`, { key });

/** File links work for 10 minutes; ask again for fresh ones. */
export const enrolmentMaterials = async (id: string) => (await list<Material>(`/v1/coaching/orders/${enc(id)}/materials`)).items;

export const enrolmentMessages = async (id: string) => (await list<Message>(`/v1/coaching/orders/${enc(id)}/messages`)).items;

/** `from` is India's YYYY-MM-DD; cancelled classes come too, so changes show. */
export const timetable = async (from: string, days = 7) => (await list<TimetableRow>("/v1/coaching/timetable", { from, days })).items;

export const myCertificates = async () => (await list<Certificate>("/v1/coaching/certificates")).items;

export const myChildren = async () => (await list<Child>("/v1/coaching/children")).items;

export const addChild = (body: { name: string; birthYear: number | null }, key: string) => one<Child>("POST", "/v1/coaching/children", { body, key });

export const updateChild = (id: string, body: { name?: string; birthYear?: number | null }) => one<Child>("PATCH", `/v1/coaching/children/${enc(id)}`, { body });

export const removeChild = async (id: string) => {
  await one<{ done: true }>("DELETE", `/v1/coaching/children/${enc(id)}`);
};

// The institute: courses and batches. Only the owner.

export const businessCourses = (businessId: string) => list<VendorCourse>(`/v1/vendor/businesses/${enc(businessId)}/courses`);

export const createCourse = (businessId: string, body: CourseInput, key: string) =>
  one<VendorCourse>("POST", `/v1/vendor/businesses/${enc(businessId)}/courses`, { body, key });

export const getVendorCourse = (id: string) => one<VendorCourse>("GET", `/v1/vendor/courses/${enc(id)}`);

export const updateCourse = (id: string, body: CoursePatch) => one<VendorCourse>("PATCH", `/v1/vendor/courses/${enc(id)}`, { body });

export const setCoursePhoto = (id: string, photo: Blob) => one<VendorCourse>("POST", `/v1/vendor/courses/${enc(id)}/photo`, { file: photo });

export const publishCourse = (id: string, key: string) => one<VendorCourse>("POST", `/v1/vendor/courses/${enc(id)}/publish`, { key });

/** Drafts nobody has enrolled in. */
export const deleteCourse = async (id: string) => {
  await one<{ done: true }>("DELETE", `/v1/vendor/courses/${enc(id)}`);
};

export const addBatch = (courseId: string, body: BatchInput, key: string) => one<VendorCourse>("POST", `/v1/vendor/courses/${enc(courseId)}/batches`, { body, key });

export const updateBatch = (batchId: string, body: BatchPatch) => one<VendorCourse>("PATCH", `/v1/vendor/batches/${enc(batchId)}`, { body });

/** Before the first class: everyone is refunded in full and told why. */
export const cancelBatch = (batchId: string, reason: string, key: string) =>
  one<VendorCourse>("POST", `/v1/vendor/batches/${enc(batchId)}/cancel`, { body: { reason }, key });

export const deleteBatch = (batchId: string) => one<VendorCourse>("DELETE", `/v1/vendor/batches/${enc(batchId)}`);

export const courseStudents = (courseId: string, filter: StudentsFilter, cursor?: string) =>
  list<StudentRow>(`/v1/vendor/courses/${enc(courseId)}/students`, { ...filter, cursor });

// Classes, for the owner and coaches.

export const deskBatches = async () => (await list<DeskBatch>("/v1/coaching/desk/batches")).items;

export const todaysClasses = async () => (await list<TodayClass>("/v1/coaching/desk/today")).items;

export const getDeskBatch = (id: string) => one<DeskBatchDetail>("GET", `/v1/coaching/desk/batches/${enc(id)}`);

export const getRoster = (classId: string) => one<Roster>("GET", `/v1/coaching/desk/classes/${enc(classId)}`);

export const markAttendance = (classId: string, marks: { orderId: string; present: boolean }[]) =>
  one<Roster>("PUT", `/v1/coaching/desk/classes/${enc(classId)}/attendance`, { body: { marks } });

/** Everyone is told why; demo students booked into it are refunded. */
export const cancelClass = (classId: string, reason: string, key: string) =>
  one<DeskBatchDetail>("POST", `/v1/coaching/desk/classes/${enc(classId)}/cancel`, { body: { reason }, key });

export const moveClass = (classId: string, body: { startsAt: string; minutes?: number; reason?: string }, key: string) =>
  one<DeskBatchDetail>("POST", `/v1/coaching/desk/classes/${enc(classId)}/move`, { body, key });

export const addExtraClass = (batchId: string, body: { startsAt: string; minutes: number }, key: string) =>
  one<DeskBatchDetail>("POST", `/v1/coaching/desk/batches/${enc(batchId)}/classes`, { body, key });

export const batchMessages = async (batchId: string) => (await list<Message>(`/v1/coaching/desk/batches/${enc(batchId)}/messages`)).items;

export const messageBatch = (batchId: string, text: string, key: string) =>
  one<Message>("POST", `/v1/coaching/desk/batches/${enc(batchId)}/messages`, { body: { text }, key });

export const batchMaterials = async (batchId: string) => (await list<Material>(`/v1/coaching/desk/batches/${enc(batchId)}/materials`)).items;

export const shareLink = (batchId: string, body: { title: string; url: string; wholeCourse?: boolean }, key: string) =>
  one<Material>("POST", `/v1/coaching/desk/batches/${enc(batchId)}/materials`, { body, key });

/** A PDF, JPEG or PNG up to 20 MB. */
export const uploadMaterial = (batchId: string, title: string, file: Blob, wholeCourse: boolean, key: string) =>
  one<Material>("POST", `/v1/coaching/desk/batches/${enc(batchId)}/materials/file`, { query: { title, wholeCourse: wholeCourse || undefined }, file, key });

export const removeMaterial = async (id: string) => {
  await one<{ done: true }>("DELETE", `/v1/coaching/desk/materials/${enc(id)}`);
};

export const batchStudents = async (batchId: string) => (await list<DeskStudent>(`/v1/coaching/desk/batches/${enc(batchId)}/students`)).items;

// The console.

export const staffCourses = (filter: { status?: StaffCourseStatus; q?: string }, cursor?: string) => list<VendorCourse>("/v1/ruxstar/coaching/courses", { ...filter, cursor });

export const getStaffCourse = (id: string) => one<VendorCourse>("GET", `/v1/ruxstar/coaching/courses/${enc(id)}`);

/** Cancels its batches and refunds every place not yet settled; the institute and students see the reason. */
export const takeDownCourse = (id: string, reason: string, key: string) =>
  one<VendorCourse>("POST", `/v1/ruxstar/coaching/courses/${enc(id)}/take-down`, { body: { reason }, key });
