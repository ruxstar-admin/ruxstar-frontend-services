"use client";

import { useState } from "react";
import { allows, useAccess } from "@/components/admin/AdminFrame";
import { Cells, count, Freshness, Group, Metric, plural, useLoad, waiting } from "@/components/admin/metrics";
import { Failed, styles } from "@/components/admin/parts";
import { useMe } from "@/components/social/session";
import { Button, Skeleton } from "@/components/ui";
import { getOverview, getStats } from "@/lib/api/admin";
import { money } from "@/lib/api/shops";
import { supportSummary } from "@/lib/api/support";
import { MODULE_LABEL } from "./modules/labels";
import { hasNumbers, ModuleCard } from "./modules/numbers";

const loadStats = () => getStats();

/** "On 4 posts, 2 people and 1 review". */
const reportedOn = (r: { posts: number; people: number; reviews: number }) =>
  `On ${plural(r.posts, "post")}, ${plural(r.people, "person", "people")} and ${plural(r.reviews, "review")}`;

/** The console home: every number the console has, grouped by area, each one opening the page behind it. The overview adds what only it has (delivery partners waiting, what was reported, staff, modules live). */
export function Dashboard() {
  const me = useMe();
  const access = useAccess();
  const [attempt, setAttempt] = useState(0);
  const canDesk = allows(access, "support.view");
  const stats = useLoad(loadStats, true, attempt);
  const overview = useLoad(getOverview, true, attempt);
  const support = useLoad(supportSummary, canDesk, attempt);
  const refresh = () => setAttempt((n) => n + 1);

  const s = stats.data;
  const o = overview.data;
  const q = s?.queues;
  const anyQueue = q && Object.values(q).some((n) => n !== null);
  const modules = s?.modules.filter(hasNumbers) ?? [];
  const pay = s?.money?.payouts;
  const first = me?.name.split(" ")[0];

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>{first ? `Hi ${first}` : "Dashboard"}</h1>
          <p className={styles.muted}>
            {access.admin ? "You are an admin, so every section is open to you." : `Signed in as ${access.title ?? "Ruxstar staff"}.`}
          </p>
        </div>
        {s && <Freshness asOf={s.asOf} loading={stats.loading} failed={Boolean(stats.error)} onRefresh={refresh} />}
      </div>

      {!s && stats.error ? (
        <Failed error={stats.error} onRetry={refresh} />
      ) : !s ? (
        <div className={styles.page} aria-busy>
          {[6, 6, 12, 7].map((n, i) => (
            <Skeleton key={i} height={76 + Math.ceil(n / 3) * 90} radius={18} />
          ))}
        </div>
      ) : (
        <>
          {q && anyQueue && (
            <Group title="Waiting for a decision" icon="alert" tint="amber">
              {q.kyc !== null && (
                <>
                  <Metric href="/admin/kyc" label="Verification to review" value={count(q.kyc)} tone={waiting(q.kyc)} />
                  {o?.kyc && <Metric href="/admin/kyc?track=delivery" label="Of those, delivery partners" value={count(o.kyc.delivery)} />}
                </>
              )}
              {q.helpTickets !== null && (
                <Metric href="/admin/support" label="Help tickets waiting" value={count(q.helpTickets)} tone={waiting(q.helpTickets)} />
              )}
              {q.reports !== null && (
                <Metric
                  href="/admin/reports"
                  label="Reports to review"
                  value={count(q.reports)}
                  detail={o?.reports ? reportedOn(o.reports) : undefined}
                  tone={waiting(q.reports)}
                />
              )}
              {q.orderProblems !== null && (
                <Metric href="/admin/reports" label="Print order problems" value={count(q.orderProblems)} tone={waiting(q.orderProblems)} />
              )}
              {q.staysObjections !== null && (
                <Metric href="/admin/objections" label="Tenant objections" value={count(q.staysObjections)} tone={waiting(q.staysObjections)} />
              )}
              {q.shopReturns !== null && (
                <Metric href="/admin/store-orders" label="Shop returns" value={count(q.shopReturns)} tone={waiting(q.shopReturns)} />
              )}
            </Group>
          )}

          {canDesk && (
            <Group title="Help tickets" icon="chat" tint="blue">
              {support.data ? (
                <>
                  <Metric href="/admin/support" label="Open" value={count(support.data.open)} />
                  <Metric href="/admin/support" label="Past reply-by" value={count(support.data.overdue)} tone={waiting(support.data.overdue)} />
                  <Metric href="/admin/support" label="With nobody on them" value={count(support.data.unassigned)} tone={waiting(support.data.unassigned)} />
                  <Metric href="/admin/support" label="Assigned to you" value={count(support.data.mine)} />
                  <Metric href="/admin/support" label="Waiting on the person" value={count(support.data.waiting)} />
                </>
              ) : support.error ? (
                <div className={styles.metricFailed} role="alert">
                  <span className={styles.muted}>Could not load help tickets.</span>
                  <Button variant="ghost" onClick={refresh}>
                    Try again
                  </Button>
                </div>
              ) : (
                <Cells n={5} />
              )}
            </Group>
          )}

          {(s.people || o?.staff) && (
            <Group title="People" icon="users" tint="purple">
              {s.people && (
                <>
                  <Metric href="/admin/users" label="Accounts" value={count(s.people.total)} />
                  <Metric href="/admin/users" label="Joined today" value={count(s.people.joinedToday)} />
                  <Metric href="/admin/users" label="Joined this week" value={count(s.people.joinedThisWeek)} />
                  <Metric href="/admin/users" label="Verified" value={count(s.people.verified)} />
                  <Metric href="/admin/users" label="On hold" value={count(s.people.onHold)} />
                </>
              )}
              {o?.staff && <Metric href="/admin/staff" label="Ruxstar staff" value={count(o.staff.active)} />}
            </Group>
          )}

          {s.money && pay && (
            <Group title="Money" icon="wallet" tint="green">
              <Metric label="Collected today" value={money(s.money.collectedToday)} />
              <Metric label="Collected this week" value={money(s.money.collectedThisWeek)} />
              <Metric label="Collected this month" value={money(s.money.collectedThisMonth)} />
              <Metric label="Refunded today" value={money(s.money.refundsToday)} />
              <Metric label="Refunded this month" value={money(s.money.refundsThisMonth)} />
              <Metric href="/admin/payouts" label="Held for vendors and partners" value={money(s.money.held)} />
              <Metric href="/admin/payouts" label="Withdrawals on the way" value={money(pay.pending.amount)} detail={plural(pay.pending.count, "withdrawal")} />
              <Metric
                href="/admin/payouts"
                label="Failed withdrawals"
                value={money(pay.failed.amount)}
                detail={plural(pay.failed.count, "withdrawal")}
                tone={waiting(pay.failed.count)}
              />
              <Metric href="/admin/payouts" label="Paid out this month" value={money(pay.paidThisMonth.amount)} detail={plural(pay.paidThisMonth.count, "withdrawal")} />
            </Group>
          )}

          {modules.length > 0 && (
            <Group title="Businesses by module" icon="store" tint="purple" wide>
              {modules.map((m) => (
                <ModuleCard key={m.module} m={m} />
              ))}
            </Group>
          )}

          {o?.modules && (
            <Group title="Modules" icon="stack" tint="amber">
              {o.modules.map((m) => (
                <Metric key={m.module} href={`/admin/modules/${m.module}`} label={MODULE_LABEL[m.module]} value={m.live ? "Live" : "Off"} tone={m.live ? "good" : "quiet"} />
              ))}
            </Group>
          )}
        </>
      )}
    </div>
  );
}
