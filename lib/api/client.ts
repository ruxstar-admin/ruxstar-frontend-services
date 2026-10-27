import createClient, { type Middleware } from "openapi-fetch";
import type { components, paths } from "./schema";

export type ApiErrorBody = components["schemas"]["Error"]["error"];
export type ApiErrorCode = ApiErrorBody["code"] | "NETWORK";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details: ApiErrorBody["details"] = [],
    readonly requestId: string | null = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === "production" ? "https://api.ruxstar.com" : "http://localhost:8080");

const identify: Middleware = {
  onRequest({ request }) {
    request.headers.set("X-Client", "web");
    return request;
  },
};

/** Typed from the API's OpenAPI spec. Auth rides on httpOnly cookies, so nothing is stored in the browser. */
export const api = createClient<paths>({ baseUrl: API_URL, credentials: "include" });
api.use(identify);

/** One key per user action. Reuse it when retrying that same action. */
export const newIdempotencyKey = () => crypto.randomUUID();

/** Returns the success envelope or throws one `ApiError`, so screens handle a single error type. */
export async function unwrap<T>(call: Promise<{ data?: T; error?: unknown; response: Response }>): Promise<T> {
  let result: Awaited<typeof call>;
  try {
    result = await call;
  } catch {
    throw new ApiError(0, "NETWORK", "You seem to be offline. Check your connection and try again.");
  }

  const { data, error, response } = result;
  if (response.ok && data !== undefined) return data;

  const requestId = response.headers.get("x-request-id");
  const body = (error as { error?: ApiErrorBody } | undefined)?.error;
  if (body) throw new ApiError(response.status, body.code, body.message, body.details, requestId);
  throw new ApiError(response.status, "INTERNAL", "Something went wrong on our side.", [], requestId);
}
