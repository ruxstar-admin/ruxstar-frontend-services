"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { count, Freshness, Group, Metric, plural, useLoad } from "@/components/admin/metrics";
import { Failed, styles } from "@/components/admin/parts";
import { Icon, Skeleton } from "@/components/ui";
import { getStats, type ModuleStats, type StatsModule } from "@/lib/api/admin";
import { money } from "@/lib/api/shops";
import { LISTINGS_LABEL, MODULE_ICON, MODULE_LABEL, MODULE_LIST, ORDERS_LABEL } from "./labels";

/** False when every section is null: the person may see none of this module's numbers. */
export const hasNumbers = (m: ModuleStats) => Boolean(m.businesses || m.listings || m.orders || m.money);

/** One module on the dashboard: a line for each section the person may see, under a link to the module's list. */
export function ModuleCard({ m }: { m: ModuleStats }) {
  const { businesses: b, listings: l, orders: o, money: cash } = m;
  const id = `module-numbers-${m.module}`;
  return (
    <section className={styles.moduleCard} aria-labelledby={id}>
      <h3 id={id} className={styles.moduleCardHead}>
        <Link href={MODULE_LIST[m.module]} className={styles.linkRow}>
          <span className={styles.metricIcon}>
            <Icon name={MODULE_ICON[m.module]} size={16} />
          </span>
          <span className={styles.whoRow}>{MODULE_LABEL[m.module]}</span>
          <Icon name="chevron-right" size={18} className={styles.chevron} />
        </Link>
      </h3>
      <dl className={styles.moduleFigures}>
        {b && (
          <div>
            <dt>Businesses</dt>
            <dd>
              {count(b.live)} live · {plural(b.drafts, "draft")} · {count(b.takenDown)} taken down
            </dd>
          </div>
        )}
        {l && (
          <div>
            <dt>{LISTINGS_LABEL[l.kind]}</dt>
            <dd>
              {count(l.live)} live · {count(l.takenDown)} taken down
            </dd>
          </div>
        )}
        {o && (
          <div>
            <dt>{ORDERS_LABEL[m.module]}</dt>
            <dd>
              {count(o.today)} today · {count(o.thisWeek)} this week · {count(o.open)} under way
            </dd>
          </div>
        )}
        {cash && (
          <div>
            <dt>Money</dt>
            <dd>
              {money(cash.collectedThisMonth)} collected this month · {money(cash.held)} held
            </dd>
          </div>
        )}
      </dl>
    </section>
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

  const { businesses: b, listings: l, orders: o, money: cash } = m;
  const list = MODULE_LIST[module];
  const orders = ORDERS_LABEL[module];
  const ordersHref = module === "shop" ? "/admin/store-orders" : undefined;
  return (
    <Group
      title="Numbers"
      icon={MODULE_ICON[module]}
      tint="purple"
      aside={<Freshness asOf={stats.data.asOf} loading={stats.loading} failed={Boolean(stats.error)} onRefresh={refresh} />}
    >
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
