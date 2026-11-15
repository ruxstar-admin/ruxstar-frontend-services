"use client";

import { count, Group, Metric, plural, waiting } from "@/components/admin/metrics";
import type { Overview, Stats } from "@/lib/api/admin";
import { money } from "@/lib/api/shops";
import { AREA, type SupportSummary } from "./sections";

type Payouts = NonNullable<Stats["money"]>["payouts"];

/** "On 4 posts, 2 people and 1 review". */
const reportedOn = (r: { posts: number; people: number; reviews: number }) =>
  `On ${plural(r.posts, "post")}, ${plural(r.people, "person", "people")} and ${plural(r.reviews, "review")}`;

const payoutLabel = (label: string, p: Payouts["pending"]) => `${label} (${count(p.count)})`;

export function WaitingArea({ q, o }: { q: NonNullable<Stats["queues"]>; o?: Overview }) {
  return (
    <Group title={AREA.waiting.label} icon={AREA.waiting.icon} tint={AREA.waiting.tint}>
      {q.kyc !== null && (
        <>
          <Metric href="/admin/kyc" label="Verification to review" value={count(q.kyc)} tone={waiting(q.kyc)} />
          {o?.kyc && <Metric href="/admin/kyc?track=delivery" label="Of those, delivery partners" value={count(o.kyc.delivery)} />}
        </>
      )}
      {q.helpTickets !== null && <Metric href="/admin/support" label="Help tickets to answer" value={count(q.helpTickets)} tone={waiting(q.helpTickets)} />}
      {q.reports !== null && (
        <Metric href="/admin/reports" label="Open reports" value={count(q.reports)} detail={o?.reports ? reportedOn(o.reports) : undefined} tone={waiting(q.reports)} />
      )}
      {q.orderProblems !== null && (
        <Metric href="/admin/reports" label="Print order problems" value={count(q.orderProblems)} tone={waiting(q.orderProblems)} />
      )}
      {q.staysObjections !== null && (
        <Metric href="/admin/objections" label="PG objections" value={count(q.staysObjections)} tone={waiting(q.staysObjections)} />
      )}
      {q.shopReturns !== null && (
        <Metric href="/admin/store-orders?returns=open" label="Shop returns open" value={count(q.shopReturns)} tone={waiting(q.shopReturns)} />
      )}
    </Group>
  );
}

export function HelpArea({ desk }: { desk: SupportSummary }) {
  return (
    <Group title={AREA.help.label} icon={AREA.help.icon} tint={AREA.help.tint}>
      <Metric href="/admin/support" label="Open" value={count(desk.open)} />
      <Metric href="/admin/support" label="Past reply-by" value={count(desk.overdue)} tone={waiting(desk.overdue)} />
      <Metric href="/admin/support" label="With nobody on them" value={count(desk.unassigned)} tone={waiting(desk.unassigned)} />
      <Metric href="/admin/support" label="Assigned to you" value={count(desk.mine)} />
      <Metric href="/admin/support" label="Waiting on the person" value={count(desk.waiting)} tone="quiet" />
    </Group>
  );
}

export function PeopleArea({ people, staff }: { people: NonNullable<Stats["people"]>; staff?: Overview["staff"] }) {
  return (
    <Group title={AREA.people.label} icon={AREA.people.icon} tint={AREA.people.tint}>
      <Metric href="/admin/users" label="Accounts" value={count(people.total)} />
      <Metric href="/admin/users" label="Joined today" value={count(people.joinedToday)} />
      <Metric href="/admin/users" label="Joined this week" value={count(people.joinedThisWeek)} />
      <Metric href="/admin/users" label="Verified" value={count(people.verified)} tone="good" />
      <Metric href="/admin/users" label="On hold" value={count(people.onHold)} tone="quiet" />
      {staff && <Metric href="/admin/staff" label="Ruxstar staff" value={count(staff.active)} />}
    </Group>
  );
}

export function MoneyArea({ m }: { m: NonNullable<Stats["money"]> }) {
  const pay = m.payouts;
  return (
    <Group title={AREA.money.label} icon={AREA.money.icon} tint={AREA.money.tint}>
      <Metric label="Collected today" value={money(m.collectedToday)} tone="good" />
      <Metric label="This week" value={money(m.collectedThisWeek)} />
      <Metric label="This month" value={money(m.collectedThisMonth)} />
      <Metric label="Refunded today" value={money(m.refundsToday)} />
      <Metric label="Refunded this month" value={money(m.refundsThisMonth)} />
      <Metric href="/admin/payouts" label="Held for vendors and partners" value={money(m.held)} />
      <Metric href="/admin/payouts" label={payoutLabel("Withdrawals on the way", pay.pending)} value={money(pay.pending.amount)} />
      <Metric href="/admin/payouts" label={payoutLabel("Failed withdrawals", pay.failed)} value={money(pay.failed.amount)} tone={waiting(pay.failed.count)} />
      <Metric href="/admin/payouts" label={payoutLabel("Paid out this month", pay.paidThisMonth)} value={money(pay.paidThisMonth.amount)} />
    </Group>
  );
}
