import { NextResponse } from "next/server";

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

  const headers = new Headers();
  headers.set("Accept", "application/json");

  if (request) {
    const auth = request.headers.get("authorization");
    if (auth) headers.set("Authorization", auth);
  }

  const init: RequestInit = { method, headers, cache: "no-store" };

  if (request && method !== "GET" && method !== "HEAD") {
    const body = await request.arrayBuffer();
    if (body.byteLength > 0) {
      init.body = body;
      // Express only parses JSON when Content-Type is application/json.
      headers.set(
        "Content-Type",
        request.headers.get("content-type") ?? "application/json",
      );
    }
  }

  try {
    let upstreamUrl = `${base}${normalizedPath}`;
    if (request) {
      const search = new URL(request.url).search;
      if (search) upstreamUrl += search;
    }

    const response = await fetch(upstreamUrl, init);
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
