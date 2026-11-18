"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, ButtonLink, Icon, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { InvoiceLinks } from "@/components/invoices/InvoiceLinks";
import { PriceLine, Timeline } from "@/components/stays/pieces";
import { BriefCard, DeliveryCard, useFileOpener } from "@/components/gigs/files";
import { NotePanel } from "@/components/gigs/NotePanel";
import { formError } from "@/lib/api/account";
import { ApiError, keepIdempotencyKey, newIdempotencyKey } from "@/lib/api/client";
import { approveGigOrder, askRevision, cancelGigOrder, getGigOrder, payGigOrder, reportGigProblem, type GigOrder } from "@/lib/api/gigs";
import { money } from "@/lib/api/shops";
import { offerWord } from "@/lib/coupons";
import { deadlineText, momentText, orderStatus, orderTimeline, packageLine } from "@/lib/gigs";
import shop from "@/components/shop/shop.module.css";
import order from "@/components/shop/order.module.css";
import events from "@/components/events/events.module.css";

/** While it's open, each look also asks whether it was paid, delivered or answered. */
const POLL_MS = 8000;

/** Its own chunk: only orders that can have a review download it. */
const Rate = dynamic(() => import("@/components/reviews/Reviews").then((m) => m.Rate));

const finished = (o: GigOrder) => o.status === "completed" || o.status === "cancelled";
const CANCELLED_BY = { customer: "you", vendor: "the freelancer", staff: "Ruxstar", system: "Ruxstar" } as const;

type Busy = "pay" | "approve" | "revision" | "problem" | "cancel" | null;
type Open = Exclude<Busy, "pay" | null> | null;

function OrderView({ item, fresh, onChanged }: { item: GigOrder; fresh: boolean; onChanged: (next: GigOrder) => void }) {
  const [busy, setBusy] = useState<Busy>(null);
  const [open, setOpen] = useState<Open>(null);
  const [error, setError] = useState<string | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [now] = useState(Date.now);
  const keys = useRef<{ sig: string; key: string } | null>(null);
  const files = useFileOpener(
    useCallback(async () => {
      const next = await getGigOrder(item.id);
      onChanged(next);
      return next;
    }, [item.id, onChanged]),
  );
  const status = orderStatus(item);
  const unpaid = item.status === "awaiting_payment";
  const cancelled = item.status === "cancelled";
  const deadline = deadlineText(item, now);
  const latest = item.deliveries.at(-1);
  const full = item.refunds.find((r) => r.kind === "full");
  const part = item.refunds.find((r) => r.kind === "part");
  const name = item.freelancer.name;

  const keyFor = (sig: string) => {
    if (keys.current?.sig !== sig) keys.current = { sig, key: newIdempotencyKey() };
    return keys.current.key;
  };
  const run = async (kind: Exclude<Open, null>, action: (key: string) => Promise<GigOrder>, sig: string) => {
    setBusy(kind);
    setPanelError(null);
    try {
      onChanged(await action(keyFor(`${kind}|${sig}`)));
      setOpen(null);
      keys.current = null;
    } catch (err) {
      setPanelError(formError(err).message);
      if (!keepIdempotencyKey(err)) keys.current = null;
    } finally {
      setBusy(null);
    }
  };
  const toggle = (next: Open) => {
    setOpen((o) => (o === next ? null : next));
    setPanelError(null);
  };

  /** Stays busy on success: the page is leaving for the payment page. */
  const pay = async () => {
    setBusy("pay");
    setError(null);
    try {
      const { checkoutUrl } = await payGigOrder(item.id, `${window.location.origin}/orders/freelance`);
      window.location.assign(checkoutUrl);
    } catch (err) {
      setError(formError(err).message);
      setBusy(null);
    }
  };

  return (
    <div className={order.page}>
      {fresh && !unpaid && !cancelled && (
        <div className={events.wait} data-offered role="status">
          <strong>{item.quoteId ? `Paid! ${name} can start now.` : `Order placed! ${name} has it now.`}</strong>
        </div>
      )}

      <div className={order.titleRow}>
        <div className={shop.head}>
          <h1 className={order.title}>
            {item.gigId ? (
              <Link href={`/gigs/${item.gigId}`} className={events.titleLink}>
                {item.title}
              </Link>
            ) : (
              item.title
            )}
          </h1>
          <p className={order.small}>{`Order #${item.orderNo} · ${name}`}</p>
          <p className={order.small}>{packageLine(item)}</p>
          {deadline && (
            <p className={item.late ? order.error : order.small}>{deadline}</p>
          )}
        </div>
        <Tag tone={status.tone}>{status.label}</Tag>
      </div>

      {unpaid && item.payBy && (
        <div className={order.news} role="status">
          <p className={order.small}>{`Pay by ${momentText(item.payBy)} or the order is cancelled.`}</p>
        </div>
      )}
      {item.status === "paid" && item.acceptBy && (
        <div className={order.news}>
          <p className={order.small}>{`${name} accepts it by ${momentText(item.acceptBy)}, or you get everything back.`}</p>
        </div>
      )}
      {item.status === "delivered" && item.autoCompleteAt && (
        <div className={order.news}>
          <p className={order.small}>{`Check the delivery. If you don’t answer by ${momentText(item.autoCompleteAt)}, it completes and the freelancer is paid.`}</p>
        </div>
      )}
      {item.late && (
        <div className={order.news} role="status">
          <p className={order.small}>It’s past the due date. You can cancel for a full refund, or keep waiting.</p>
        </div>
      )}
      {cancelled && (
        <div className={order.news}>
          <p className={order.small}>{item.cancellation ? `Cancelled by ${CANCELLED_BY[item.cancellation.by]}: ${item.cancellation.reason}` : "Cancelled."}</p>
        </div>
      )}
      {full && (
        <div className={order.news}>
          <p className={order.small}>
            {full.status === "done" ? `${money(full.amount)} refunded to how you paid. Banks take up to 7 days to show it.` : `Refunding ${money(full.amount)}…`}
          </p>
        </div>
      )}
      {part && (
        <div className={order.news}>
          <p className={order.small}>{`${money(part.amount)} ${part.status === "done" ? "refunded" : "being refunded"} to how you paid.`}</p>
        </div>
      )}
      {item.dispute && (
        <div className={order.news} role="status">
          <p className={order.small}>
            {item.dispute.decision ? `Ruxstar decided: ${item.dispute.decision.note}` : "You reported a problem. Ruxstar is looking at it and will reply on your help ticket."}
          </p>
        </div>
      )}

      {error && (
        <p className={order.error} role="alert">
          {error}
        </p>
      )}
      {unpaid && (
        <Button size="lg" loading={busy === "pay"} onClick={() => void pay()}>
          {`Pay ${money(item.price.total)}`}
        </Button>
      )}
      {item.can.approve &&
        (open === "approve" ? (
          <NotePanel
            title="Approve this delivery?"
            message={`The order completes and ${name} is paid. You can’t ask for changes after this.`}
            prompt="A word for the freelancer (optional)"
            placeholder="Thanks, it’s great"
            max={500}
            confirm="Approve and complete"
            busy={busy === "approve"}
            failure={panelError}
            onConfirm={(note) => void run("approve", (key) => approveGigOrder(item.id, note || undefined, key), note)}
            onCancel={() => toggle(null)}
          />
        ) : (
          <Button size="lg" onClick={() => toggle("approve")}>
            Approve and complete
          </Button>
        ))}

      {!cancelled && !unpaid && (
        <section className={order.section}>
          <h2 className={order.overline}>Progress</h2>
          <Timeline steps={orderTimeline(item)} />
        </section>
      )}

      {item.deliveries.length > 0 && (
        <section className={order.section}>
          <h2 className={order.overline}>Deliveries</h2>
          {item.deliveries.map((d, i) => (
            <DeliveryCard key={d.id} delivery={d} number={i + 1} opening={files.opening} onOpen={(fileId) => void files.open(fileId)} />
          ))}
        </section>
      )}
      {item.filesDeleted && <p className={order.small}>The files on this order were deleted after it ended. Messages and links stay.</p>}
      {files.problem && (
        <p className={order.error} role="alert">
          {files.problem}
        </p>
      )}

      {open === "revision" ? (
        <NotePanel
          title="Ask for changes"
          message={`Say what to change. ${item.revisions.left === 1 ? "This is your last revision." : `You have ${item.revisions.left} revisions left.`}`}
          prompt="What to change"
          placeholder="The colours, the wording, a part that’s missing"
          min={5}
          max={1000}
          confirm="Send"
          busy={busy === "revision"}
          failure={panelError}
          onConfirm={(note) => void run("revision", (key) => askRevision(item.id, note, key), note)}
          onCancel={() => toggle(null)}
        />
      ) : open === "problem" ? (
        <NotePanel
          title="Report a problem"
          message="Ruxstar looks at the order and decides on a refund. The freelancer isn’t paid until then."
          prompt="What’s wrong"
          placeholder="What you asked for and what you got"
          min={10}
          max={2000}
          confirm="Report"
          danger
          busy={busy === "problem"}
          failure={panelError}
          onConfirm={(reason) => void run("problem", (key) => reportGigProblem(item.id, reason, key), reason)}
          onCancel={() => toggle(null)}
        />
      ) : (
        (item.can.revise || item.can.report || (latest && !latest.answer && item.revisions.left === 0)) && (
          <div className={order.actions}>
            {item.can.revise ? (
              <Button variant="secondary" onClick={() => toggle("revision")}>
                {`Ask for changes (${item.revisions.left} left)`}
              </Button>
            ) : latest && !latest.answer && item.revisions.left === 0 ? (
              <p className={order.small}>No revisions left on this order.</p>
            ) : null}
            {item.can.report && (
              <button type="button" className={events.textLink} data-danger onClick={() => toggle("problem")}>
                Report a problem
              </button>
            )}
          </div>
        )
      )}

      <section className={order.section}>
        <h2 className={order.overline}>Your brief</h2>
        <BriefCard order={item} opening={files.opening} onOpen={(fileId) => void files.open(fileId)} />
        {!item.answers.length && !item.note && !item.files.length && <p className={order.small}>You didn’t add a brief. Message the freelancer anything they need.</p>}
        <div>
          <Link href={`/messages/with/${item.freelancer.userId}`} className={events.textLink}>
            {`Message ${name}`}
          </Link>
        </div>
      </section>

      <div className={order.panel}>
        <dl className={order.prices}>
          <PriceLine label={item.quoteId ? "Offer" : item.package.name} amount={item.price.items} />
          {item.price.discount > 0 && (
            <PriceLine label={item.coupon ? `Coupon ${item.coupon.code} · ${offerWord(item.coupon.fundedBy, "gigs")}` : "Discount"} amount={item.price.discount} minus />
          )}
          {item.price.platformFee > 0 && <PriceLine label="Platform fee" amount={item.price.platformFee} />}
          <PriceLine label={unpaid ? "To pay" : "Paid"} amount={item.price.total} strong />
        </dl>
      </div>
      <InvoiceLinks refs={item.invoices} audience="customer" />

      {item.canReview && (
        <Rate
          orderId={item.id}
          module="gigs"
          open
          until={item.reviewUntil ?? null}
          words={{
            ask: "Rate this order",
            askLine: `How did it go? Your review helps others choose ${name}.`,
            writeTitle: `Rate ${name}`,
            placeholder: "The work, keeping to time, how they were to deal with",
          }}
        />
      )}

      {item.can.cancel &&
        (open === "cancel" ? (
          <NotePanel
            title="Cancel this order?"
            message={unpaid ? "Nothing has been paid, so nothing is charged." : `${money(item.price.total)} goes back to how you paid.`}
            confirm="Cancel order"
            danger
            busy={busy === "cancel"}
            failure={panelError}
            onConfirm={() => void run("cancel", (key) => cancelGigOrder(item.id, undefined, key), "")}
            onCancel={() => toggle(null)}
          />
        ) : (
          <div>
            <button type="button" className={events.textLink} data-danger onClick={() => toggle("cancel")}>
              {unpaid ? "Cancel order" : `Cancel and get ${money(item.price.total)} back`}
            </button>
          </div>
        ))}
    </div>
  );
}

/** One freelance order: paying, the progress, each delivery with its files, approving, changes, problems, cancelling and a review. */
export function GigOrderScreen({ id, fresh }: { id: string; fresh: boolean }) {
  const onSignedOut = useOnSignedOut();
  const [item, setItem] = useState<GigOrder | null>(null);
  const [error, setError] = useState<unknown>(null);
  const done = item ? finished(item) : true;

  const load = useCallback(
    () =>
      getGigOrder(id).then(
        (o) => {
          setItem(o);
          setError(null);
        },
        (err: unknown) => !onSignedOut(err) && setError(err),
      ),
    [id, onSignedOut],
  );

  useEffect(() => {
    void load();
    const onShow = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, [load]);

  useEffect(() => {
    if (done) return;
    const timer = setInterval(() => document.visibilityState === "visible" && void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [done, load]);

  if (item) return <OrderView item={item} fresh={fresh} onChanged={setItem} />;
  if (error) {
    const gone = error instanceof ApiError && error.status === 404;
    return (
      <Empty title={gone ? "Order not found" : "Could not load this order"}>
        <p>{formError(error).message}</p>
        {gone ? (
          <ButtonLink href="/orders?tab=freelance" variant="secondary">
            Your freelance orders
          </ButtonLink>
        ) : (
          <Button variant="secondary" icon={<Icon name="refresh" size={16} />} onClick={() => void load()}>
            Try again
          </Button>
        )}
      </Empty>
    );
  }
  return (
    <div className={order.page} aria-busy>
      <div className={shop.skeletonCard} />
    </div>
  );
}
