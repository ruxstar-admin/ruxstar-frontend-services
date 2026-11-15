"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { allows, useAccess } from "@/components/admin/AdminFrame";
import { Failed, styles } from "@/components/admin/parts";
import { useMe, useOnSignedOut } from "@/components/social/session";
import { Button, Card, Icon, Skeleton, type IconName } from "@/components/ui";
import { getOverview, heldOrders, listPayouts } from "@/lib/api/admin";
import type { Page } from "@/lib/api/social";
import { supportSummary } from "@/lib/api/support";
import { MODULE_LABEL } from "./modules/labels";

type Tone = "warn" | "good" | "quiet";
type Tint = "amber" | "blue" | "purple" | "green";

const count = (n: number) => n.toLocaleString("en-IN");
const waiting = (n: number): Tone | undefined => (n > 0 ? "warn" : undefined);

/** A list's first page: "20+" when it has more pages. Payouts have no count route. */
const pageCount = (page: Page<unknown>) => `${count(page.items.length)}${page.nextCursor ? "+" : ""}`;

const loadMoney = () =>
  Promise.all([listPayouts("pending"), listPayouts("failed"), heldOrders(undefined)]).then(([pending, failed, held]) => ({
    pending: pageCount(pending),
    failed: pageCount(failed),
    failedAny: failed.items.length > 0,
    held: pageCount(held),
  }));

/** One source, loaded on its own so a slow or failing one doesn't hold the others back. An error shows only for the latest attempt. */
function useLoad<T>(load: () => Promise<T>, enabled: boolean, attempt: number) {
  const onSignedOut = useOnSignedOut();
  const [result, setResult] = useState<{ at: number; data?: T; error?: unknown }>({ at: -1 });

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    load().then(
      (data) => live && setResult({ at: attempt, data }),
      (error) => live && !onSignedOut(error) && setResult((r) => ({ ...r, at: attempt, error })),
    );
    return () => {
      live = false;
    };
  }, [load, enabled, attempt, onSignedOut]);

  return { data: result.data, error: result.at === attempt ? result.error : undefined, loading: enabled && result.at !== attempt };
}

function Group({ title, icon, tint, children }: { title: string; icon: IconName; tint: Tint; children: ReactNode }) {
  const id = `metrics-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <Card as="section" padding="lg" aria-labelledby={id}>
      <h2 id={id} className={styles.metricHead}>
        <span className={styles.metricIcon} data-tint={tint}>
          <Icon name={icon} size={18} />
        </span>
        {title}
      </h2>
      <div className={styles.metrics}>{children}</div>
    </Card>
  );
}

function Metric({ href, label, value, tone }: { href: string; label: string; value: string; tone?: Tone }) {
  return (
    <Link href={href} className={styles.metric} data-tone={tone}>
      <span className={styles.metricValue}>{value}</span>
      <span className={styles.metricLabel}>{label}</span>
    </Link>
  );
}

function Cells({ n }: { n: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <Skeleton key={i} height={76} radius={12} />
      ))}
    </>
  );
}

/** The console home: every count the console has, grouped by area, each one opening the page behind it. Same as the app. */
export function Dashboard() {
  const me = useMe();
  const access = useAccess();
  const [attempt, setAttempt] = useState(0);
  const canDesk = allows(access, "support.view");
  const canMoney = allows(access, "payouts.view");
  const overview = useLoad(getOverview, true, attempt);
  const support = useLoad(supportSummary, canDesk, attempt);
  const money = useLoad(loadMoney, canMoney, attempt);
  const retry = () => setAttempt((n) => n + 1);

  const o = overview.data;
  const desk = support.data ?? o?.support ?? null;
  const first = me?.name.split(" ")[0];

  return (
    <div className={styles.page}>
      <div>
        <h1 className={styles.title}>{first ? `Hi ${first}` : "Dashboard"}</h1>
        <p className={styles.muted}>
          {access.admin ? "You are an admin, so every section is open to you." : `Signed in as ${access.title ?? "Ruxstar staff"}.`}
        </p>
      </div>

      {!o && overview.error ? (
        <Failed error={overview.error} onRetry={retry} />
      ) : !o ? (
        <div className={styles.page} aria-busy>
          {[3, 3, 6].map((n, i) => (
            <Skeleton key={i} height={76 + Math.ceil(n / 3) * 90} radius={18} />
          ))}
        </div>
      ) : (
        <>
          {(o.kyc || o.reports || o.orders) && (
            <Group title="Waiting for a decision" icon="alert" tint="amber">
              {o.kyc && (
                <>
                  <Metric href="/admin/kyc" label="Verification to review" value={count(o.kyc.waiting)} tone={waiting(o.kyc.waiting)} />
                  <Metric href="/admin/kyc?track=delivery" label="Of those, delivery partners" value={count(o.kyc.delivery)} />
                </>
              )}
              {o.reports && (
                <>
                  <Metric href="/admin/reports" label="Reported posts" value={count(o.reports.posts)} tone={waiting(o.reports.posts)} />
                  <Metric href="/admin/reports" label="Reports on those posts" value={count(o.reports.reports)} />
                  <Metric href="/admin/reports" label="Reported people" value={count(o.reports.people)} tone={waiting(o.reports.people)} />
                  <Metric href="/admin/reports" label="Reported reviews" value={count(o.reports.reviews)} tone={waiting(o.reports.reviews)} />
                </>
              )}
              {o.orders && <Metric href="/admin/reports" label="Print order problems" value={count(o.orders.problems)} tone={waiting(o.orders.problems)} />}
            </Group>
          )}

          {desk && (
            <Group title="Help tickets" icon="chat" tint="blue">
              <Metric href="/admin/support" label="Open" value={count(desk.open)} />
              <Metric href="/admin/support" label="Past reply-by" value={count(desk.overdue)} tone={waiting(desk.overdue)} />
              <Metric href="/admin/support" label="With nobody on them" value={count(desk.unassigned)} tone={waiting(desk.unassigned)} />
              {support.data ? (
                <>
                  <Metric href="/admin/support" label="Assigned to you" value={count(support.data.mine)} />
                  <Metric href="/admin/support" label="Waiting on the person" value={count(support.data.waiting)} />
                </>
              ) : support.loading ? (
                <Cells n={2} />
              ) : null}
            </Group>
          )}

          {(o.users || o.staff) && (
            <Group title="People" icon="users" tint="purple">
              {o.users && (
                <>
                  <Metric href="/admin/users" label="Accounts" value={count(o.users.total)} />
                  <Metric href="/admin/users" label="Joined this week" value={count(o.users.newThisWeek)} />
                  <Metric href="/admin/users" label="On hold" value={count(o.users.suspended)} />
                </>
              )}
              {o.staff && <Metric href="/admin/staff" label="Ruxstar staff" value={count(o.staff.active)} />}
            </Group>
          )}

          {o.businesses && (
            <Group title="Businesses" icon="store" tint="purple">
              <Metric href="/admin/businesses" label="All businesses" value={count(o.businesses.total)} />
              <Metric href="/admin/businesses" label="Live" value={count(o.businesses.live)} />
              <Metric href="/admin/businesses" label="On hold" value={count(o.businesses.suspended)} />
            </Group>
          )}

          {canMoney && (
            <Group title="Money" icon="wallet" tint="green">
              {money.data ? (
                <>
                  <Metric href="/admin/payouts" label="Withdrawals on the way" value={money.data.pending} />
                  <Metric href="/admin/payouts" label="Failed withdrawals" value={money.data.failed} tone={money.data.failedAny ? "warn" : undefined} />
                  <Metric href="/admin/payouts" label="Orders with money on hold" value={money.data.held} />
                </>
              ) : money.error ? (
                <div className={styles.metricFailed} role="alert">
                  <span className={styles.muted}>Could not load payouts.</span>
                  <Button variant="ghost" onClick={retry}>
                    Try again
                  </Button>
                </div>
              ) : (
                <Cells n={3} />
              )}
            </Group>
          )}

          {o.modules && (
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
