import { signedIn } from "./account";
import { API_URL, api, unwrap } from "./client";
import type { paths } from "./schema";

type Json<P extends keyof paths, M extends keyof paths[P]> = paths[P][M] extends {
  responses: { 200: { content: { "application/json": infer B } } };
}
  ? B
  : never;

export type Post = Json<"/v1/social/posts/{id}", "get">["data"];
export type Photo = Post["media"][number];
export type Comment = Json<"/v1/social/posts/{id}/comments", "get">["data"][number];
export type Notification = Json<"/v1/notifications/", "get">["data"][number];
export type PostKind = Post["kind"];
export type ReportReason = paths["/v1/social/posts/{id}/report"]["post"]["requestBody"]["content"]["application/json"]["reason"];
export type FeedTab = NonNullable<NonNullable<paths["/v1/social/feed"]["get"]["parameters"]["query"]>["tab"]>;
export type Person = Json<"/v1/social/users/{ref}/followers", "get">["data"][number];
export type Relation = Json<"/v1/social/users/{ref}/relation", "get">["data"];
export type UserReportReason = paths["/v1/social/users/{id}/report"]["post"]["requestBody"]["content"]["application/json"]["reason"];
type Upload = paths["/v1/social/media"]["post"]["responses"][201]["content"]["application/json"];

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export const POST_TEXT_MAX = 500;
export const POST_PHOTOS_MAX = 4;
export const COMMENT_TEXT_MAX = 300;
/** The API keeps the long side at 1440 px, so sending more is wasted upload time. */
export const POST_PHOTO_SIDE = 1440;

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "spam", label: "Spam or scam" },
  { value: "fake", label: "Fake store or listing" },
  { value: "abuse", label: "Rude or abusive" },
  { value: "undelivered", label: "Paid, but never received it" },
  { value: "other", label: "Something else" },
];

export const USER_REPORT_REASONS: { value: UserReportReason; label: string }[] = [
  { value: "spam", label: "Spam" },
  { value: "fake", label: "Fake account or pretending to be someone" },
  { value: "abuse", label: "Rude or abusive" },
  { value: "scam", label: "Scam or asking for money" },
  { value: "other", label: "Something else" },
];

/** Every size of a photo for `srcSet`, so browsers fetch the smallest that looks sharp. */
export const photoSrcSet = (photo: Photo) =>
  // Photos from before the API made smaller copies have none.
  [...(photo.smaller ?? []), photo].map((p) => `${p.url} ${p.width}w`).join(", ");

const toPage = <T>(envelope: { data: T[]; meta: { nextCursor?: string | null } }): Page<T> => ({
  items: envelope.data,
  nextCursor: envelope.meta.nextCursor ?? null,
});

const id = (value: string) => ({ params: { path: { id: value } } });

/** For you ranks the week's posts by likes and comments; Following is people you follow, newest first. */
export const feed = async (tab: FeedTab, cursor?: string) =>
  toPage(await signedIn(() => unwrap(api.GET("/v1/social/feed", { params: { query: { tab, cursor } } }))));

/** A multiple of three, so the profile grid fills whole rows. */
export const PROFILE_PAGE = 24;

export const userPosts = async (ref: string, kind: PostKind, cursor?: string) =>
  toPage(await unwrap(api.GET("/v1/social/users/{ref}/posts", { params: { path: { ref }, query: { kind, cursor, limit: PROFILE_PAGE } } })));

export const savedPosts = async (cursor?: string) =>
  toPage(await signedIn(() => unwrap(api.GET("/v1/social/saved", { params: { query: { cursor } } }))));

export const getPost = async (postId: string) => (await unwrap(api.GET("/v1/social/posts/{id}", id(postId)))).data;

/** The spec has no body for this route (it is the raw image), so it skips the typed client. */
async function postPhoto(photo: Blob) {
  const response = await fetch(`${API_URL}/v1/social/media`, {
    method: "POST",
    credentials: "include",
    headers: { "X-Client": "web", "Content-Type": photo.type },
    body: photo,
  });
  const parsed: unknown = await response.json().catch(() => undefined);
  return response.ok ? { data: parsed as Upload, response } : { error: parsed, response };
}

export const uploadPhoto = async (photo: Blob) => (await signedIn(() => unwrap(postPhoto(photo)))).data;

/** `businessId` names which of the vendor's businesses a business post is for. */
export const createPost = async (body: { text: string; mediaIds: string[]; kind: PostKind; businessId?: string }) =>
  (await signedIn(() => unwrap(api.POST("/v1/social/posts", { body })))).data;

export const editPost = async (postId: string, text: string) =>
  (await signedIn(() => unwrap(api.PATCH("/v1/social/posts/{id}", { ...id(postId), body: { text } })))).data;

export const deletePost = (postId: string) => signedIn(() => unwrap(api.DELETE("/v1/social/posts/{id}", id(postId))));

export const setLike = async (postId: string, on: boolean) =>
  (await signedIn(() => unwrap(on ? api.PUT("/v1/social/posts/{id}/like", id(postId)) : api.DELETE("/v1/social/posts/{id}/like", id(postId))))).data;

export const setSave = async (postId: string, on: boolean) =>
  (await signedIn(() => unwrap(on ? api.PUT("/v1/social/posts/{id}/save", id(postId)) : api.DELETE("/v1/social/posts/{id}/save", id(postId))))).data;

export const reportPost = (postId: string, reason: ReportReason) =>
  signedIn(() => unwrap(api.POST("/v1/social/posts/{id}/report", { ...id(postId), body: { reason } })));

export const comments = async (postId: string, cursor?: string) =>
  toPage(await unwrap(api.GET("/v1/social/posts/{id}/comments", { params: { path: { id: postId }, query: { cursor } } })));

export const addComment = async (postId: string, text: string) =>
  (await signedIn(() => unwrap(api.POST("/v1/social/posts/{id}/comments", { ...id(postId), body: { text } })))).data;

export const deleteComment = (commentId: string) => signedIn(() => unwrap(api.DELETE("/v1/social/comments/{id}", id(commentId))));

export const notifications = async (cursor?: string) =>
  toPage(await signedIn(() => unwrap(api.GET("/v1/notifications/", { params: { query: { cursor } } }))));

export const unreadCount = async () => (await signedIn(() => unwrap(api.GET("/v1/notifications/unread-count")))).data.count;

export const markRead = (notificationId?: string) =>
  signedIn(() => unwrap(api.POST("/v1/notifications/read", { body: notificationId ? { id: notificationId } : {} })));

const ref = (value: string) => ({ params: { path: { ref: value } } });

/** `who` is a username or a user id. */
export const relation = async (who: string) => (await signedIn(() => unwrap(api.GET("/v1/social/users/{ref}/relation", ref(who))))).data;

export const setFollow = async (userId: string, on: boolean) =>
  (await signedIn(() => unwrap(on ? api.PUT("/v1/social/users/{id}/follow", id(userId)) : api.DELETE("/v1/social/users/{id}/follow", id(userId))))).data;

/** Signed out works too: `followedByMe` is then always false. */
export const followers = async (who: string, cursor?: string) =>
  toPage(await unwrap(api.GET("/v1/social/users/{ref}/followers", { params: { path: { ref: who }, query: { cursor } } })));

export const following = async (who: string, cursor?: string) =>
  toPage(await unwrap(api.GET("/v1/social/users/{ref}/following", { params: { path: { ref: who }, query: { cursor } } })));

/** Both of you stop seeing each other, and follows both ways end. They aren't told. */
export const setBlock = async (userId: string, on: boolean) =>
  (await signedIn(() => unwrap(on ? api.PUT("/v1/social/users/{id}/block", id(userId)) : api.DELETE("/v1/social/users/{id}/block", id(userId))))).data;

export const blocked = async (cursor?: string) => toPage(await signedIn(() => unwrap(api.GET("/v1/social/blocks", { params: { query: { cursor } } }))));

export const reportUser = (userId: string, reason: UserReportReason) =>
  signedIn(() => unwrap(api.POST("/v1/social/users/{id}/report", { ...id(userId), body: { reason } })));

/** Without `q`, the newest members. Never includes you. */
export const findPeople = async (q?: string) =>
  (await signedIn(() => unwrap(api.GET("/v1/account/profiles", { params: { query: q ? { q } : {} } })))).data;

/** For server components: anonymous, cached briefly, and null when the post is gone. */
export async function fetchPublicPost(postId: string): Promise<Post | null> {
  if (!/^[a-f0-9]{24}$/.test(postId)) return null;
  const res = await fetch(`${API_URL}/v1/social/posts/${postId}`, { headers: { "X-Client": "web" }, next: { revalidate: 30 } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Post lookup failed with ${res.status}`);
  return ((await res.json()) as { data: Post }).data;
}

/** For server components: the first page of one profile tab, anonymous and cached briefly. */
export async function fetchPublicPosts(username: string, kind: PostKind): Promise<Page<Post>> {
  const res = await fetch(`${API_URL}/v1/social/users/${encodeURIComponent(username)}/posts?kind=${kind}&limit=${PROFILE_PAGE}`, {
    headers: { "X-Client": "web" },
    next: { revalidate: 30 },
  });
  if (!res.ok) return { items: [], nextCursor: null };
  return toPage((await res.json()) as { data: Post[]; meta: { nextCursor?: string | null } });
}
