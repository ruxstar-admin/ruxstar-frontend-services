import { NextResponse } from "next/server";

const FORWARD_HEADERS = ["content-type", "authorization", "accept"];

export async function proxyBackend(path: string, request?: Request) {
  const base = process.env.BACKEND_URL?.trim().replace(/\/$/, "");

  if (!base) {
    return NextResponse.json(
      { error: "BACKEND_URL environment variable is not set" },
      { status: 500 },
    );
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const method = request?.method ?? "GET";
  const headers: Record<string, string> = { Accept: "application/json" };

  if (request) {
    for (const key of FORWARD_HEADERS) {
      const value = request.headers.get(key);
      if (value) headers[key] = value;
    }
  }

  const init: RequestInit = { method, headers, cache: "no-store" };

  if (request && method !== "GET" && method !== "HEAD") {
    init.body = await request.text();
  }

  try {
    const response = await fetch(`${base}${normalizedPath}`, init);
    const text = await response.text();

    return new NextResponse(text, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reach backend";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
