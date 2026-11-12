import { signedIn } from "./account";
import { api, newIdempotencyKey, unwrap } from "./client";
import type { paths } from "./schema";
import type { Page } from "./social";

type Json<P extends keyof paths, M extends keyof paths[P]> = paths[P][M] extends {
  responses: { 200: { content: { "application/json": infer B } } };
}
  ? B
  : never;
type Query<P extends keyof paths> = paths[P] extends { get: { parameters: { query?: infer Q } } } ? NonNullable<Q> : never;

export type Access = Json<"/v1/ruxstar/access", "get">["data"];
export type Permission = Access["permissions"][number];
export type Overview = Json<"/v1/ruxstar/overview", "get">["data"];
export type ReportCase = Json<"/v1/ruxstar/reports", "get">["data"][number];
export type ReportStatus = NonNullable<Query<"/v1/ruxstar/reports">["status"]>;
export type PersonCase = Json<"/v1/ruxstar/reports/people", "get">["data"][number];
export type UserRow = Json<"/v1/ruxstar/users", "get">["data"][number];
export type UserDetail = Json<"/v1/ruxstar/users/{id}", "get">["data"];
export type UserStatus = UserRow["status"];
export type StaffMember = Json<"/v1/ruxstar/staff", "get">["data"][number];
export type ModuleSettings = Json<"/v1/ruxstar/modules", "get">["data"][number];
export type ModuleName = ModuleSettings["module"];
export type ModulePatch = paths["/v1/ruxstar/modules/{module}"]["patch"]["requestBody"]["content"]["application/json"];
export type AuditEntry = Json<"/v1/ruxstar/audit", "get">["data"][number];
export type AuditFilter = Omit<Query<"/v1/ruxstar/audit">, "cursor" | "limit">;

const toPage = <T>(envelope: { data: T[]; meta: { nextCursor?: string | null } }): Page<T> => ({
  items: envelope.data,
  nextCursor: envelope.meta.nextCursor ?? null,
});
const keyed = (key: string) => ({ headers: { "Idempotency-Key": key } });

export const getAccess = async () => (await signedIn(() => unwrap(api.GET("/v1/ruxstar/access")))).data;

export const getOverview = async () => (await signedIn(() => unwrap(api.GET("/v1/ruxstar/overview")))).data;

// Reported posts.

export const reportQueue = async (status: ReportStatus, cursor?: string) =>
  toPage(await signedIn(() => unwrap(api.GET("/v1/ruxstar/reports", { params: { query: { status, cursor } } }))));

export const keepPost = async (postId: string, key = newIdempotencyKey()) =>
  (await signedIn(() => unwrap(api.POST("/v1/ruxstar/reports/{postId}/keep", { params: { path: { postId } }, ...keyed(key) })))).data;

export const removePost = async (postId: string, reason: string, key = newIdempotencyKey()) =>
  (
    await signedIn(() =>
      unwrap(api.POST("/v1/ruxstar/reports/{postId}/remove", { params: { path: { postId } }, body: { reason }, ...keyed(key) })),
    )
  ).data;

// Reported people.

export const personQueue = async (status: ReportStatus, cursor?: string) =>
  toPage(await signedIn(() => unwrap(api.GET("/v1/ruxstar/reports/people", { params: { query: { status, cursor } } }))));

/** To act on the account instead, put it on hold; that closes these too. */
export const dismissPerson = async (userId: string, key = newIdempotencyKey()) =>
  (await signedIn(() => unwrap(api.POST("/v1/ruxstar/reports/people/{userId}/dismiss", { params: { path: { userId } }, ...keyed(key) })))).data;

// People.

export const findUsers = async (q: string, status: UserStatus | undefined, cursor?: string) =>
  toPage(
    await signedIn(() =>
      unwrap(api.GET("/v1/ruxstar/users", { params: { query: { ...(q.trim() ? { q: q.trim() } : {}), ...(status ? { status } : {}), cursor } } })),
    ),
  );

export const getUser = async (id: string) =>
  (await signedIn(() => unwrap(api.GET("/v1/ruxstar/users/{id}", { params: { path: { id } } })))).data;

export const suspendUser = async (id: string, reason: string, key = newIdempotencyKey()) =>
  (await signedIn(() => unwrap(api.POST("/v1/ruxstar/users/{id}/suspend", { params: { path: { id } }, body: { reason }, ...keyed(key) })))).data;

export const unlockUser = async (id: string, key = newIdempotencyKey()) =>
  (await signedIn(() => unwrap(api.POST("/v1/ruxstar/users/{id}/unlock", { params: { path: { id } }, ...keyed(key) })))).data;

export const signOutUser = async (id: string, key = newIdempotencyKey()) =>
  (await signedIn(() => unwrap(api.POST("/v1/ruxstar/users/{id}/sign-out", { params: { path: { id } }, ...keyed(key) })))).data;

// Ruxstar staff, admins only.

export const listStaff = async () => (await signedIn(() => unwrap(api.GET("/v1/ruxstar/staff")))).data;

export const saveStaff = async (userId: string, title: string, permissions: Permission[], key = newIdempotencyKey()) =>
  (
    await signedIn(() =>
      unwrap(api.PUT("/v1/ruxstar/staff/{userId}", { params: { path: { userId } }, body: { title, permissions }, ...keyed(key) })),
    )
  ).data;

export const removeStaff = async (userId: string, key = newIdempotencyKey()) =>
  (await signedIn(() => unwrap(api.DELETE("/v1/ruxstar/staff/{userId}", { params: { path: { userId } }, ...keyed(key) })))).data;

// Modules.

export const listModules = async () => (await signedIn(() => unwrap(api.GET("/v1/ruxstar/modules")))).data;

export const updateModule = async (module: ModuleName, patch: ModulePatch, key = newIdempotencyKey()) =>
  (
    await signedIn(() =>
      unwrap(api.PATCH("/v1/ruxstar/modules/{module}", { params: { path: { module } }, body: patch, ...keyed(key) })),
    )
  ).data;

// Vendors' businesses.

export type BusinessRow = Json<"/v1/ruxstar/businesses", "get">["data"][number];
export type Business = BusinessRow["business"];
export type BusinessCase = Json<"/v1/ruxstar/businesses/{id}", "get">["data"];
export type BusinessFilter = Omit<Query<"/v1/ruxstar/businesses">, "cursor" | "limit">;
export type BusinessState = NonNullable<BusinessFilter["state"]>;

export const findBusinesses = async (filter: BusinessFilter, cursor?: string) =>
  toPage(await signedIn(() => unwrap(api.GET("/v1/ruxstar/businesses", { params: { query: { ...filter, cursor } } }))));

export const getBusiness = async (id: string) =>
  (await signedIn(() => unwrap(api.GET("/v1/ruxstar/businesses/{id}", { params: { path: { id } } })))).data;

/** The vendor is told the reason. */
export const holdBusiness = async (id: string, reason: string, key = newIdempotencyKey()) =>
  (
    await signedIn(() =>
      unwrap(api.POST("/v1/ruxstar/businesses/{id}/suspend", { params: { path: { id } }, body: { reason }, ...keyed(key) })),
    )
  ).data;

export const restoreBusiness = async (id: string, key = newIdempotencyKey()) =>
  (await signedIn(() => unwrap(api.POST("/v1/ruxstar/businesses/{id}/restore", { params: { path: { id } }, ...keyed(key) })))).data;

/** Business types and print products by id, the same lists the app's Add a business screens use. */
export type BusinessCatalog = Json<"/v1/vendor/catalog", "get">["data"];

let catalog: Promise<BusinessCatalog> | null = null;
export const getBusinessCatalog = () =>
  (catalog ??= signedIn(() => unwrap(api.GET("/v1/vendor/catalog"))).then(
    (res) => res.data,
    (err) => {
      catalog = null;
      throw err;
    },
  ));

// Audit log.

export const auditLog = async (filter: AuditFilter, cursor?: string) =>
  toPage(await signedIn(() => unwrap(api.GET("/v1/ruxstar/audit", { params: { query: { ...filter, cursor } } }))));
