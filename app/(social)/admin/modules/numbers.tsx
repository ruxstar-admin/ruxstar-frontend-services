"use client";

import { useCallback, useState, type ReactNode } from "react";
import { count, Freshness, Group, Metric, useLoad } from "@/components/admin/metrics";
import { Failed } from "@/components/admin/parts";
import { Skeleton } from "@/components/ui";
import { getStats, type ModuleStats, type StatsModule } from "@/lib/api/admin";
import { money } from "@/lib/api/shops";
import { LISTINGS_LABEL, MODULE_ICON, MODULE_LIST, ORDERS_LABEL } from "./labels";

/** False when every section is null: the person may see none of this module's numbers. */
export const hasNumbers = (m: ModuleStats) => Boolean(m.businesses || m.listings || m.orders || m.money);

/** Every number the stats route has for one module, each opening the module's list when it has one. */
export function ModuleFigures({ m, aside }: { m: ModuleStats; aside?: ReactNode }) {
  const { module, businesses: b, listings: l, orders: o, money: cash } = m;
  const list = MODULE_LIST[module];
  const orders = ORDERS_LABEL[module];
  const ordersHref = module === "shop" ? "/admin/store-orders" : undefined;
  return (
    <Group title="Numbers" icon={MODULE_ICON[module]} tint="purple" aside={aside}>
      {b && (
        <>
          <Metric href={list} label="Live businesses" value={count(b.live)} />
          <Metric href={list} label="Drafts" value={count(b.drafts)} />
          <Metric href={list} label="Taken down" value={count(b.takenDown)} />
        </>
      )}
      {l && (
        <>
          <Metric href={list} label={`${LISTINGS_LABEL[l.kind]} live`} value={count(l.live)} />
          <Metric href={list} label={`${LISTINGS_LABEL[l.kind]} taken down`} value={count(l.takenDown)} />
        </>
      )}
      {o && (
        <>
          <Metric href={ordersHref} label={`${orders} today`} value={count(o.today)} />
          <Metric href={ordersHref} label={`${orders} this week`} value={count(o.thisWeek)} />
          <Metric href={ordersHref} label={`${orders} under way`} value={count(o.open)} />
        </>
      )}
      {cash && (
        <>
          <Metric label="Collected today" value={money(cash.collectedToday)} />
          <Metric label="Collected this week" value={money(cash.collectedThisWeek)} />
          <Metric label="Collected this month" value={money(cash.collectedThisMonth)} />
          <Metric label="Refunded today" value={money(cash.refundsToday)} />
          <Metric label="Refunded this month" value={money(cash.refundsThisMonth)} />
          <Metric href="/admin/payouts" label="Held for vendors" value={money(cash.held)} />
        </>
      )}
    </Group>
  );
}

/** The top of a module's page: every number the stats route has for it. Nothing when the person may see none of them. */
export function ModuleNumbers({ module }: { module: StatsModule }) {
  const [attempt, setAttempt] = useState(0);
  const load = useCallback(() => getStats(module), [module]);
  const stats = useLoad(load, true, attempt);
  const refresh = () => setAttempt((n) => n + 1);

  if (!stats.data) return stats.error ? <Failed error={stats.error} onRetry={refresh} /> : <Skeleton height={260} radius={18} />;
  const m = stats.data.modules[0];
  if (!m || !hasNumbers(m)) return null;

  return <ModuleFigures m={m} aside={<Freshness asOf={stats.data.asOf} loading={stats.loading} failed={Boolean(stats.error)} onRefresh={refresh} />} />;
}
