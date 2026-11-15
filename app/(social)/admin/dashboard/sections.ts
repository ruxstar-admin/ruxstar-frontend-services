import type { Tint } from "@/components/admin/metrics";
import type { IconName } from "@/components/ui";
import type { ModuleStats, Stats, StatsModule } from "@/lib/api/admin";
import type { supportSummary } from "@/lib/api/support";
import { MODULE_LABEL } from "../modules/labels";

export type SupportSummary = Awaited<ReturnType<typeof supportSummary>>;

/** The dashboard's areas, each a tile on the home and a page of its own. Same as the app. */
export type DashboardArea = "waiting" | "help" | "people" | "money" | "businesses";

/** Modules under Businesses, in the order the owner reads them. Delivery has its own tile. */
export const BUSINESS_MODULES: readonly StatsModule[] = ["events", "pod", "coaching", "turf", "stays", "shop"];

export const AREA: Record<DashboardArea, { label: string; icon: IconName; tint: Tint }> = {
  waiting: { label: "Waiting for Ruxstar", icon: "alert", tint: "amber" },
  help: { label: "Help tickets", icon: "chat", tint: "blue" },
  people: { label: "People", icon: "users", tint: "purple" },
  money: { label: "Money", icon: "wallet", tint: "green" },
  businesses: { label: "Businesses", icon: "store", tint: "purple" },
};

const AREAS = Object.keys(AREA) as DashboardArea[];
const STATS_MODULES: readonly string[] = [...BUSINESS_MODULES, "delivery"];

/** A dashboard page's key from a link: an area, or one module's numbers. */
export type DashboardSection = DashboardArea | StatsModule;

export const isDashboardSection = (value: unknown): value is DashboardSection =>
  typeof value === "string" && ((AREAS as string[]).includes(value) || STATS_MODULES.includes(value));

export const isArea = (section: DashboardSection): section is DashboardArea => (AREAS as string[]).includes(section);

export const sectionHref = (section: DashboardSection) => `/admin/dashboard/${section}`;

export const sectionTitle = (section: DashboardSection) => (isArea(section) ? AREA[section].label : MODULE_LABEL[section]);

/** Queues with at least one count this person may see. */
export const hasQueues = (q: Stats["queues"] | undefined): q is NonNullable<Stats["queues"]> => !!q && Object.values(q).some((n) => n !== null);

/** Everything waiting for Ruxstar that this person may see. */
export const queueTotal = (q: Stats["queues"] | undefined) => (q ? Object.values(q).reduce<number>((sum, n) => sum + (n ?? 0), 0) : 0);

/** Tickets that need someone now: past their reply-by time, or with nobody on them. */
export const ticketsNeedingYou = (desk: SupportSummary) => desk.overdue + desk.unassigned;

/** Live businesses across the given module blocks. */
export const liveBusinesses = (blocks: ModuleStats[]) => blocks.reduce((sum, b) => sum + (b.businesses?.live ?? 0), 0);

/** One line under a module's tile: what is happening there right now. */
export function moduleLine(b: ModuleStats, count: (n: number) => string): string {
  if (b.module === "delivery" && b.orders) return `${count(b.orders.open)} under way`;
  if (b.businesses) return `${count(b.businesses.live)} live`;
  if (b.listings) return `${count(b.listings.live)} live`;
  if (b.orders) return `${count(b.orders.today)} today`;
  return "Open";
}
