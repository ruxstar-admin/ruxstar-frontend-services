export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ businessId: string; photoId: string }>;
};

/** Streams business photos with cache headers (binary-safe; catch-all proxy is JSON/text only). */
export async function GET(_request: Request, context: RouteContext) {
  const { businessId, photoId } = await context.params;
  const base = process.env.BACKEND_URL?.trim().replace(/\/$/, "");

  if (!base) {
    return new Response(JSON.stringify({ error: "BACKEND_URL not set" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const upstream = await fetch(`${base}/public/businesses/${businessId}/photos/${photoId}`, {
      redirect: "manual",
    });

    if (upstream.status >= 300 && upstream.status < 400) {
      const location = upstream.headers.get("location");
      if (location) {
        return Response.redirect(location, upstream.status);
      }
    }

    const headers = new Headers();
    const contentType = upstream.headers.get("content-type");
    const cacheControl = upstream.headers.get("cache-control");
    if (contentType) headers.set("Content-Type", contentType);
    headers.set("Cache-Control", cacheControl ?? "public, max-age=31536000, immutable");

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reach backend";
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}
