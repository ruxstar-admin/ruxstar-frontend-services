import type { IconName } from "@/components/ui";
import type { ModuleName, ModuleSettings } from "@/lib/api/admin";
import type { GstModule } from "@/lib/api/invoices";
import { money } from "@/lib/api/shops";

export const MODULE_LABEL: Record<ModuleName, string> = {
  pod: "Print on demand",
  events: "Events",
  coaching: "Coaching",
  stays: "PG and hostel stays",
  turf: "Sports & turf",
  shop: "Local shops",
  delivery: "Delivery",
  ledger: "Payments and ledger",
};

export const MODULE_ICON: Record<ModuleName, IconName> = {
  pod: "print",
  events: "calendar",
  coaching: "book",
  stays: "bed",
  turf: "ball",
  shop: "bag",
  delivery: "bicycle",
  ledger: "wallet",
};

export const GST_MODULE_LABEL: Record<GstModule, string> = {
  pod: "Print on demand",
  events: "Events",
  coaching: "Coaching",
  stays: "PG and hostel stays",
  turf: "Turf",
  ecommerce: "E-commerce",
};

const has = (map: object, key: unknown): boolean => typeof key === "string" && Object.prototype.hasOwnProperty.call(map, key);

export const isModuleName = (key: unknown): key is ModuleName => has(MODULE_LABEL, key);
export const isGstModule = (key: unknown): key is GstModule => has(GST_MODULE_LABEL, key);

/** One line under a module's name in the list: what it charges, and anything switched off. Same as the app. */
export function moduleSummary(m: ModuleSettings): string {
  if (m.delivery) return `Partners get ${money(m.delivery.riderRate.base)} a trip · offers wait ${m.delivery.offerMinutes} min`;
  if (m.payouts) return `${m.payouts.fee ? `${money(m.payouts.fee)} withdrawal fee` : "No withdrawal fee"} · least ${money(m.payouts.minimum)}`;
  return [`${m.commissionBps / 100}% commission`, m.platformFee ? `${money(m.platformFee)} fee` : "no fee", m.signupsOpen ? null : "new vendors closed"]
    .filter(Boolean)
    .join(" · ");
}
