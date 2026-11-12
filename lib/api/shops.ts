import { signedIn } from "./account";
import { api, unwrap } from "./client";
import type { paths } from "./schema";
import type { Page } from "./social";

type ShopQuery = NonNullable<paths["/v1/pod/shops"]["get"]["parameters"]["query"]>;
type Catalog = paths["/v1/vendor/catalog"]["get"]["responses"][200]["content"]["application/json"]["data"];

export type Shop = paths["/v1/pod/shops/{id}"]["get"]["responses"][200]["content"]["application/json"]["data"];
export type ShopCard = paths["/v1/pod/shops"]["get"]["responses"][200]["content"]["application/json"]["data"][number];
export type ShopProduct = Shop["catalog"][number];
export type ShopPhoto = NonNullable<ShopCard["cover"]>;
export type PodProduct = NonNullable<ShopQuery["product"]>;
export type ShopFilters = Pick<ShopQuery, "q" | "product" | "city">;

export const shops = async (filters: ShopFilters, cursor?: string): Promise<Page<ShopCard>> => {
  const envelope = await signedIn(() => unwrap(api.GET("/v1/pod/shops", { params: { query: { ...filters, cursor } } })));
  return { items: envelope.data, nextCursor: envelope.meta.nextCursor ?? null };
};

export const getShop = async (id: string) => (await signedIn(() => unwrap(api.GET("/v1/pod/shops/{id}", { params: { path: { id } } })))).data;

let products: Promise<Catalog["podProducts"]> | null = null;

/** What print shops can make, for the Discover filters. Fetched once per visit. */
export function podProducts() {
  products ??= signedIn(() => unwrap(api.GET("/v1/vendor/catalog")))
    .then((r) => r.data.podProducts)
    .catch((err) => {
      products = null;
      throw err;
    });
  return products;
}

export const money = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
/** "From ₹2/page", or null while a shop has no price a customer can pay. */
export const fromLine = (shop: Pick<ShopCard, "fromPrice" | "fromUnit">) =>
  shop.fromPrice == null ? null : `From ${money(shop.fromPrice)}/${shop.fromUnit === "page" ? "page" : "unit"}`;

export const readyLine = (days: number) => (days <= 1 ? "Ready in 1 day" : `Ready in ${days} days`);

export const placeLine = (shop: Pick<ShopCard, "area" | "city">) => [shop.area, shop.city].filter(Boolean).join(", ");

const titleCase = (text: string) => text.replace(/\b\p{L}/gu, (c) => c.toUpperCase());

export function deliveryLine(shop: Pick<ShopCard, "deliversEverywhere" | "city"> & { cities?: string[] }) {
  if (shop.deliversEverywhere) return "Delivers everywhere";
  if (!shop.cities?.length) return `Delivers in ${shop.city}`;
  return `Delivers to ${shop.cities.map(titleCase).join(", ")}`;
}

export function productPrice(product: ShopProduct) {
  if (product.pricing === "per_page") {
    const parts = [product.bw ? `B/W ${money(product.bw)}` : null, product.color ? `Colour ${money(product.color)}` : null].filter(Boolean);
    return `${parts.join(" · ")} a page`;
  }
  return product.basePrice ? `${money(product.basePrice)} each` : "";
}

/** Every size of a shop photo for `srcSet`. */
export const shopSrcSet = (photo: ShopPhoto) => [...photo.smaller, photo].map((p) => `${p.url} ${p.width}w`).join(", ");

const COVER_COLOURS: readonly [string, string][] = [
  ["#7C3AED", "#32B2FA"],
  ["#B45CF2", "#FF6B8B"],
  ["#0EA5E9", "#22C55E"],
  ["#F59E0B", "#EF4444"],
  ["#6366F1", "#B45CF2"],
];

/** The same colours the app picks for a shop with no photo. */
export function coverGradient(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const [from, to] = COVER_COLOURS[hash % COVER_COLOURS.length];
  return `linear-gradient(135deg, ${from}, ${to})`;
}

export const initialOf = (name: string) => name.trim().charAt(0).toUpperCase() || "R";

export const OPTION_LABELS: Record<string, string> = {
  size: "Size",
  material: "Material",
  printType: "Print type",
  color: "Colour",
  sides: "Sides",
  paperSize: "Paper size",
  binding: "Binding",
  doubleSided: "Double-sided",
};
