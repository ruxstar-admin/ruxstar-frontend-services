import type { MetadataRoute } from "next";
import { API_URL } from "@/lib/api/client";

const SITE = "https://ruxstar.com";

export const revalidate = 3600;

/** Detail pages listed for each kind of listing. The API returns at most 50 a page. */
const PER_KIND = 200;
const PAGE_SIZE = 50;

const STATIC_PAGES = ["/", "/discover", "/terms", "/privacy", "/refunds", "/shipping", "/contact", "/delete-account"];

/** Each signed-out list on the API, and where its items open on the website. */
const LISTINGS = [
  { list: "/v1/events/", page: "/events" },
  { list: "/v1/coaching/", page: "/courses" },
  { list: "/v1/turf/", page: "/grounds" },
  { list: "/v1/stays/", page: "/stays" },
  { list: "/v1/shop/", page: "/shops" },
  { list: "/v1/shop/products", page: "/products" },
];

const isId = (id: unknown): id is string => typeof id === "string" && /^[a-f0-9]{24}$/.test(id);

/** The ids on a list, up to `PER_KIND`. Whatever loaded before a failure is kept; a failure never fails the sitemap. */
async function idsOf(list: string): Promise<string[]> {
  const ids: string[] = [];
  let cursor: string | null = null;
  try {
    do {
      const query = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (cursor) query.set("cursor", cursor);
      const res = await fetch(`${API_URL}${list}?${query}`, {
        headers: { "X-Client": "web" },
        next: { revalidate },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) break;
      const body = (await res.json()) as { data?: { id?: unknown }[]; meta?: { nextCursor?: string | null } };
      ids.push(...(body.data ?? []).map((item) => item.id).filter(isId));
      cursor = body.meta?.nextCursor ?? null;
    } while (cursor && ids.length < PER_KIND);
  } catch {}
  return ids.slice(0, PER_KIND);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = STATIC_PAGES.map((path) => ({ url: `${SITE}${path}` }));
  const found = await Promise.all(LISTINGS.map(async ({ list, page }) => (await idsOf(list)).map((id) => ({ url: `${SITE}${page}/${id}` }))));
  return [...pages, ...found.flat()];
}
