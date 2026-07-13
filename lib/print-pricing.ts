import type {
  CategoryPricing,
  PricingTier,
  PrintCategory,
  PrintOrderAttributes,
  PrintShop,
} from "@/lib/api";

/**
 * Frontend mirror of the backend price calculator
 * (`ruxstar-backend-services/utils/printPricing.js`). Keep both in sync.
 * Used for live price display; the backend recomputes authoritatively at order time.
 */

export type PriceSelection = {
  quantity?: number;
  copies?: number;
  options?: Record<string, string>;
  // per_page
  pages?: number;
  color?: "bw" | "color";
  sections?: { pages: number; color: "bw" | "color" }[];
  doubleSided?: boolean;
  binding?: string;
  paperSize?: string;
};

export type PriceResult = {
  total: number;
  currency: string;
  unavailable?: boolean;
  unitPrice?: number;
  perCopy?: number;
  totalPages?: number;
};

/** A fully-configured order ready for checkout (payment wired in a later phase). */
export type PrintOrderDraft = {
  category: PrintCategory;
  shop: PrintShop;
  city: string;
  quantity: number; // units, or copies for per_page
  selection: PriceSelection;
  attributes: PrintOrderAttributes;
  notes: string;
  designImage?: string;
  designFileName?: string;
  price: PriceResult;
};

const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);

function bestTier(
  tiers: PricingTier[] | undefined,
  amount: number,
  key: "minQty" | "minPages",
): PricingTier | null {
  if (!Array.isArray(tiers)) return null;
  let best: PricingTier | null = null;
  for (const t of tiers) {
    if (!t || !Number.isFinite(Number(t.unitPrice))) continue;
    const threshold = num(t[key]);
    if (amount >= threshold && (!best || threshold > num(best[key]))) best = t;
  }
  return best;
}

function computePerUnit(pricing: CategoryPricing, selection: PriceSelection): PriceResult {
  const quantity = Math.max(1, Math.round(num(selection.quantity)));
  const options = selection.options || {};
  const addons = pricing.addons || {};

  const tier = bestTier(pricing.tiers, quantity, "minQty");
  const base = tier ? num(tier.unitPrice) : num(pricing.basePrice);

  let addonSum = 0;
  for (const [dim, value] of Object.entries(options)) {
    if (!value) continue;
    const map = (addons as Record<string, Record<string, number> | undefined>)[dim];
    addonSum += num(map?.[value]);
  }

  const unitPrice = base + addonSum;
  return { total: Math.max(0, unitPrice * quantity), unitPrice, currency: "INR" };
}

function computePerPage(pricing: CategoryPricing, selection: PriceSelection): PriceResult {
  const copies = Math.max(1, Math.round(num(selection.copies ?? selection.quantity ?? 1)));
  const perPage = pricing.perPage || { bw: 0, color: 0 };
  const addons = pricing.addons || {};

  const sections =
    Array.isArray(selection.sections) && selection.sections.length
      ? selection.sections
      : [{ pages: num(selection.pages), color: selection.color === "color" ? "color" : "bw" }];

  const paperSizeAddon = selection.paperSize ? num(addons.paperSize?.[selection.paperSize]) : 0;
  const doubleSidedAddon = selection.doubleSided ? num(addons.doubleSided) : 0;

  let totalPages = 0;
  let pagesCost = 0;
  for (const sec of sections) {
    const pages = Math.max(0, Math.round(num(sec.pages)));
    totalPages += pages;
    const rate = sec.color === "color" ? num(perPage.color) : num(perPage.bw);
    pagesCost += pages * (rate + paperSizeAddon + doubleSidedAddon);
  }

  const tier = bestTier(pricing.tiers, totalPages, "minPages");
  if (tier) pagesCost = totalPages * (num(tier.unitPrice) + paperSizeAddon + doubleSidedAddon);

  const bindingPrice = selection.binding ? num(addons.binding?.[selection.binding]) : 0;
  const perCopy = pagesCost + bindingPrice;
  return { total: Math.max(0, perCopy * copies), perCopy, totalPages, currency: "INR" };
}

export function computePrice(
  category: Pick<PrintCategory, "pricingModel">,
  pricing: CategoryPricing | undefined,
  selection: PriceSelection = {},
): PriceResult {
  if (!pricing || pricing.enabled === false) return { total: 0, currency: "INR", unavailable: true };
  return category.pricingModel === "per_page"
    ? computePerPage(pricing, selection)
    : computePerUnit(pricing, selection);
}

export type PricingDimension = { key: "sides" | "size" | "printType" | "material" | "color"; label: string; values: string[] };

const DIMENSION_LABELS: Record<PricingDimension["key"], string> = {
  sides: "Print sides",
  size: "Size",
  printType: "Print method",
  material: "Material",
  color: "Colour",
};

/** Priceable option dimensions for a per_unit category (only ones with values). */
export function pricingDimensions(category: PrintCategory): PricingDimension[] {
  const map: { key: PricingDimension["key"]; values: string[] }[] = [
    { key: "sides", values: category.sides },
    { key: "size", values: category.sizes },
    { key: "printType", values: category.printTypes },
    { key: "material", values: category.materials },
    { key: "color", values: category.colorOptions },
  ];
  return map
    .filter((d) => Array.isArray(d.values) && d.values.length > 0)
    .map((d) => ({ key: d.key, label: DIMENSION_LABELS[d.key], values: d.values }));
}
