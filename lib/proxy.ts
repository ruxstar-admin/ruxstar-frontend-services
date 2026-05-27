import { NextResponse } from "next/server";

export async function proxyRoute(path: string) {
  const base = process.env.BACKEND_URL?.trim().replace(/\/$/, "");

  if (!base) {
    return NextResponse.json(
      { error: "BACKEND_URL environment variable is not set" },
      { status: 500 },
    );
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  try {
    const response = await fetch(`${base}${normalizedPath}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
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
