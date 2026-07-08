/** Shared types — catalog data comes from GET /catalog/business */

import type { BusinessModule } from "@/lib/api";

export type BusinessCategory = {
  id: string;
  label: string;
  description: string;
  icon: string;
  sortOrder?: number;
  types: BusinessType[];
};

export type BusinessType = {
  id: string;
  categoryId: string;
  label: string;
  description: string;
  examples: string;
  namePlaceholder: string;
  detailHint: string;
  module: BusinessModule;
  sortOrder?: number;
};

/** Display fallback if module labels haven't loaded yet */
export const FALLBACK_MODULE_LABELS: Record<BusinessModule, string> = {
  events: "Events & tickets",
  appointments: "Bookings & appointments",
  services: "Service requests",
  commerce: "Products & shop",
  creator: "Creator storefront",
  print: "Print on demand",
};

export function moduleLabel(
  module: BusinessModule,
  labels?: Record<string, string>,
): string {
  return labels?.[module] ?? FALLBACK_MODULE_LABELS[module] ?? module;
}

export function findCategory(
  categories: BusinessCategory[],
  id: string,
): BusinessCategory | undefined {
  return categories.find((c) => c.id === id);
}

export function findBusinessType(
  categories: BusinessCategory[],
  typeId: string,
): BusinessType | undefined {
  for (const cat of categories) {
    const t = cat.types.find((x) => x.id === typeId);
    if (t) return t;
  }
  return undefined;
}

export function typesForCategory(
  categories: BusinessCategory[],
  categoryId: string,
): BusinessType[] {
  return categories.find((c) => c.id === categoryId)?.types ?? [];
}
