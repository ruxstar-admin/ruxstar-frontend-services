"use client";

import { useCallback, useEffect, useState } from "react";
import { Needs, useCan } from "@/components/admin/AdminFrame";
import { Failed, Fact, styles } from "@/components/admin/parts";
import { BriefCard, DeliveryCard, useFileOpener } from "@/components/gigs/files";
import { InvoiceLinks } from "@/components/invoices/InvoiceLinks";
import { useOnSignedOut } from "@/components/social/session";
import { useActionKey } from "@/components/stays/desk";
import { Timeline } from "@/components/stays/pieces";
import { TextArea } from "@/components/vendor/parts";
import { Button, ButtonLink, Card, Icon, Input, Segmented, Skeleton, Tag, useToast } from "@/components/ui";
import { formError } from "@/lib/api/account";
import { consoleGigOrder, decideGigOrder, type DecideInput, type GigOrder } from "@/lib/api/gigs";
import { money } from "@/lib/api/shops";
import { paiseOf } from "@/lib/api/vendor";
import { maxPartRefund, momentText, orderStatus, orderTimeline, packageLine, rupeeInput } from "@/lib/gigs";
import order from "@/components/shop/order.module.css";

type Outcome = DecideInput["outcome"];

const OUTCOMES: { value: Outcome; label: string }[] = [
  { value: "full", label: "Full refund" },
  { value: "part", label: "Part refund" },
  { value: "none", label: "No refund" },
];
const OUTCOME_LABEL: Record<Outcome, string> = { full: "Full refund", part: "Part refund", none: "No refund" };

const SAYS: Record<Outcome, (o: GigOrder) => string> = {
  full: (o) => `${o.customer.name} gets ${money(o.price.total)} back, platform fee included, and the order is cancelled. ${o.freelancer.name} isn’t paid.`,
  part: (o) => `${o.customer.name} gets the amount back out of ${o.freelancer.name}’s share; the rest of the share is paid to them and the order completes.`,
  none: (o) => `${o.freelancer.name} is paid ${money(o.share ?? 0)} and the order completes.`,
};

const CANCELLED_BY = { customer: "the customer", vendor: "the freelancer", staff: "Ruxstar", system: "Ruxstar" } as const;

/** Deciding a reported problem: a full, part or no refund, with a note both sides read. */
function DecidePanel({ o, busy, onConfirm, onCancel }: { o: GigOrder; busy: boolean; onConfirm: (body: DecideInput) => void; onCancel: () => void }) {
  const [outcome, setOutcome] = useState<Outcome>("part");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const most = maxPartRefund(o);
  const paise = paiseOf(amount);
  const amountProblem = outcome !== "part" ? null : paise === null || paise < 1 ? "Enter the amount to refund." : paise > most ? `At most ${money(most)}.` : null;
  const ready = note.trim().length >= 5 && !amountProblem && (outcome !== "part" || most > 0);

  return (
    <div className={order.panel}>
      <strong>Decide this problem</strong>
      <Segmented label="Outcome" options={OUTCOMES} value={outcome} onChange={setOutcome} />
      <p className={styles.muted}>{SAYS[outcome](o)}</p>
      {outcome === "part" &&
        (most > 0 ? (
          <Input
            label="Refund (₹)"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(rupeeInput(e.target.value))}
            hint={`Up to ${money(most)}`}
            error={amount ? (amountProblem ?? undefined) : undefined}
          />
        ) : (
          <p className={styles.muted}>There’s nothing left to refund in part. Pick full or none.</p>
        ))}
      <TextArea label="Note for both sides" value={note} onChange={setNote} max={1000} placeholder="What you looked at and why you decided this" />
      <div className={styles.actions}>
        <Button
          loading={busy}
          disabled={!ready}
          onClick={() => onConfirm({ outcome, ...(outcome === "part" && paise !== null ? { amount: paise } : {}), note: note.trim() })}
        >
          Decide
        </Button>
        <Button variant="ghost" disabled={busy} onClick={onCancel}>
          Not now
        </Button>
      </div>
    </div>
  );
}

function OrderCase({ o, onChanged, refetch }: { o: GigOrder; onChanged: (next: GigOrder) => void; refetch: () => Promise<GigOrder> }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const canManage = useCan("orders.manage");
  const canAudit = useCan("audit.view");
  const [deciding, setDeciding] = useState(false);
  const [busy, setBusy] = useState(false);
  const key = useActionKey();
  const files = useFileOpener(refetch);
  const status = orderStatus(o);
  const open = o.dispute && !o.dispute.decision && o.status === "disputed";
  const refunded = o.refunds.reduce((s, r) => s + r.amount, 0);

  const decide = async (body: DecideInput) => {
    setBusy(true);
    try {
      onChanged(await decideGigOrder(o.id, body, key.keyFor(`decide:${o.id}:${JSON.stringify(body)}`)));
      key.settle();
      setDeciding(false);
      toast("Decided. Both sides have been told.", "success");
    } catch (err) {
      key.settle(err);
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card as="section" padding="lg" className={styles.page}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>{`#${o.orderNo} · ${o.title}`}</h1>
          <p className={styles.muted}>{`${o.freelancer.name} → ${o.customer.name}`}</p>
          <p className={styles.muted}>{packageLine(o)}</p>
        </div>
        <div className={styles.tags}>
          <Tag tone={status.tone}>{status.label}</Tag>
        </div>
      </div>

      {o.cancellation && (
        <p className={styles.note} data-tone="danger">
          {`Cancelled by ${CANCELLED_BY[o.cancellation.by]} ${momentText(o.cancellation.at)}${o.cancellation.reason ? `: ${o.cancellation.reason}` : ""}`}
        </p>
      )}

      {o.dispute && (
        <section className={styles.group}>
          <h2 className={styles.subtitle}>{`Problem reported ${momentText(o.dispute.openedAt)}`}</h2>
          <p className={styles.muted}>{o.dispute.reason}</p>
          {o.dispute.decision && (
            <p className={styles.note}>
              {`${OUTCOME_LABEL[o.dispute.decision.outcome]}${o.dispute.decision.amount ? ` of ${money(o.dispute.decision.amount)}` : ""} · ${momentText(o.dispute.decision.at)}: ${o.dispute.decision.note}`}
            </p>
          )}
          <div className={styles.actions}>
            <ButtonLink href={`/admin/support/${o.dispute.ticketId}`} variant="ghost" icon={<Icon name="chat" size={18} />}>
              Open the help ticket
            </ButtonLink>
            {canManage && open && !deciding && <Button onClick={() => setDeciding(true)}>Decide</Button>}
          </div>
          {canManage && open && deciding && <DecidePanel o={o} busy={busy} onConfirm={(body) => void decide(body)} onCancel={() => setDeciding(false)} />}
        </section>
      )}

      <section className={styles.group}>
        <h2 className={styles.subtitle}>Progress</h2>
        <Timeline steps={orderTimeline(o)} />
      </section>

      {(o.answers.length > 0 || o.note || o.files.length > 0) && (
        <section className={styles.group}>
          <h2 className={styles.subtitle}>Brief</h2>
          <BriefCard order={o} opening={files.opening} onOpen={(fileId) => void files.open(fileId)} />
        </section>
      )}

      {o.deliveries.length > 0 && (
        <section className={styles.group}>
          <h2 className={styles.subtitle}>Deliveries</h2>
          {o.deliveries.map((d, i) => (
            <DeliveryCard key={d.id} delivery={d} number={i + 1} opening={files.opening} onOpen={(fileId) => void files.open(fileId)} />
          ))}
        </section>
      )}
      {files.problem && (
        <p className={styles.note} data-tone="danger" role="alert">
          {files.problem}
        </p>
      )}

      <dl className={styles.facts}>
        <Fact label="Customer paid" value={money(o.price.total)} />
        <Fact label={o.quoteId ? "Offer" : "Package"} value={money(o.price.items)} />
        <Fact label="Discount" value={o.price.discount ? `${money(o.price.discount)}${o.coupon ? ` · ${o.coupon.code}` : ""}` : "None"} />
        <Fact label="Platform fee" value={money(o.price.platformFee)} />
        <Fact label="Freelancer’s share" value={o.share === null ? "Not shown" : money(o.share)} />
        <Fact label="Refunded" value={money(refunded)} warn={refunded > 0} />
        <Fact label="Revisions" value={`${o.revisions.used} of ${o.revisions.included} used`} />
        {o.dueAt && <Fact label="Due" value={momentText(o.dueAt)} warn={o.late} />}
        {o.completedAt && <Fact label="Completed" value={momentText(o.completedAt)} />}
        <Fact label="Files" value={o.filesDeleted ? "Deleted" : "Kept"} />
        <Fact label="Order id" value={o.id} />
      </dl>
      <InvoiceLinks refs={o.invoices} audience="staff" />

      <div className={styles.actions}>
        <ButtonLink href={`/admin/freelancers/${o.freelancer.businessId}`} variant="ghost" icon={<Icon name="briefcase" size={18} />}>
          Open the freelancer
        </ButtonLink>
        {o.gigId && (
          <ButtonLink href={`/admin/gigs/${o.gigId}`} variant="ghost" icon={<Icon name="stack" size={18} />}>
            Open the gig
          </ButtonLink>
        )}
        <ButtonLink href={`/admin/users/${o.customer.id}`} variant="ghost" icon={<Icon name="user" size={18} />}>
          Open the customer
        </ButtonLink>
        {canAudit && (
          <ButtonLink href={`/admin/audit?target=${o.id}`} variant="ghost" icon={<Icon name="clock" size={18} />}>
            History for this order
          </ButtonLink>
        )}
      </div>
    </Card>
  );
}

/** One freelance order for the Ruxstar team: the brief, each delivery, the money, and deciding a reported problem. */
export function GigOrderCaseScreen({ id }: { id: string }) {
  const onSignedOut = useOnSignedOut();
  const [o, setO] = useState<GigOrder | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    consoleGigOrder(id).then(
      (next) => live && setO(next),
      (err) => live && !onSignedOut(err) && setError(err),
    );
    return () => {
      live = false;
    };
  }, [id, attempt, onSignedOut]);

  const refetch = useCallback(async () => {
    const next = await consoleGigOrder(id);
    setO(next);
    return next;
  }, [id]);

  return (
    <Needs need="orders.view">
      <div className={styles.page}>
        <div>
          <ButtonLink href="/admin/gig-orders" variant="ghost" icon={<Icon name="arrow-left" size={18} />}>
            Freelance orders
          </ButtonLink>
        </div>
        {error ? (
          <Failed
            error={error}
            onRetry={() => {
              setError(null);
              setAttempt((n) => n + 1);
            }}
          />
        ) : !o ? (
          <Skeleton height={420} radius={16} />
        ) : (
          <OrderCase o={o} onChanged={setO} refetch={refetch} />
        )}
      </div>
    </Needs>
  );
}
