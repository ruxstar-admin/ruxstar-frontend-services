"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, ButtonLink, Icon, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useMe, useOnSignedOut } from "@/components/social/session";
import { InvoiceLinks } from "@/components/invoices/InvoiceLinks";
import { PriceLine, Timeline } from "@/components/stays/pieces";
import { Back, TextArea } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { BriefCard, DeliveryCard, FilesField, fileIdsOf, filesReady, useFileOpener, type HeldFile } from "@/components/gigs/files";
import { NotePanel } from "@/components/gigs/NotePanel";
import { loadGigsRules } from "@/components/gigs/use-gigs";
import { formError } from "@/lib/api/account";
import { ApiError, keepIdempotencyKey, newIdempotencyKey } from "@/lib/api/client";
import { acceptGigOrder, declineGigOrder, deliverGigOrder, deskCancelGigOrder, deskGigOrder, type DeliverInput, type GigOrder, type GigsRules } from "@/lib/api/gigs";
import { money } from "@/lib/api/shops";
import { deadlineText, deliveryErrors, linesOf, momentText, orderStatus, orderTimeline, packageLine } from "@/lib/gigs";
import shop from "@/components/shop/shop.module.css";
import order from "@/components/shop/order.module.css";
import events from "@/components/events/events.module.css";

/** While it's open, each look also asks whether it was paid, answered or reported. */
const POLL_MS = 8000;

const finished = (o: GigOrder) => o.status === "completed" || o.status === "cancelled";
const CANCELLED_BY = { customer: "the customer", vendor: "you", staff: "Ruxstar", system: "Ruxstar" } as const;

function Earnings({ item }: { item: GigOrder }) {
  if (item.share === null) return null;
  const refunded = item.refunds.reduce((s, r) => s + r.amount, 0);
  const line =
    item.status === "completed"
      ? "Paid to your balance. Withdraw it from Payments."
      : item.status === "cancelled"
        ? "Nothing is paid for a cancelled order."
        : item.status === "disputed"
          ? "Held while Ruxstar looks at the problem."
          : "Yours once the customer approves, or when it completes by itself.";
  return (
    <div className={order.panel}>
      <dl className={order.prices}>
        <PriceLine label="Customer paid" amount={item.price.total} />
        {refunded > 0 && <PriceLine label="Refunded" amount={refunded} minus />}
        <PriceLine label={item.status === "completed" ? "You got" : "You get"} amount={item.status === "cancelled" ? 0 : item.share} strong />
      </dl>
      <span className={order.faint}>{line}</span>
    </div>
  );
}

/** Sending the work: a message for the customer, links, and files uploaded as they're picked. */
function DeliverForm({ item, rules, onDelivered, onCancel }: { item: GigOrder; rules: GigsRules; onDelivered: (o: GigOrder) => void; onCancel: () => void }) {
  const [message, setMessage] = useState("");
  const [links, setLinks] = useState("");
  const [files, setFiles] = useState<HeldFile[]>([]);
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const attempt = useRef<{ sig: string; key: string } | null>(null);
  const linkList = linesOf(links);
  const errors = deliveryErrors(message, linkList, rules.limits.links);

  const send = async () => {
    setShown(true);
    if (!filesReady(files)) {
      setFailure("Wait for your files to finish sending, or remove the ones that failed.");
      return;
    }
    if (Object.keys(errors).length) return;
    setBusy(true);
    setFailure(null);
    const body: DeliverInput = { message: message.trim(), links: linkList, fileIds: fileIdsOf(files) };
    const sig = JSON.stringify(body);
    if (attempt.current?.sig !== sig) attempt.current = { sig, key: newIdempotencyKey() };
    try {
      onDelivered(await deliverGigOrder(item.id, body, attempt.current.key));
      attempt.current = null;
    } catch (err) {
      if (!keepIdempotencyKey(err)) attempt.current = null;
      setFailure(formError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={order.panel} aria-label="Deliver">
      <strong>{item.deliveries.length ? "Deliver again" : "Deliver the work"}</strong>
      <TextArea
        label="Message for the customer"
        value={message}
        onChange={setMessage}
        max={2000}
        placeholder="What you’re sending and how to use it"
        error={shown ? errors.message : undefined}
      />
      <TextArea label="Links (optional)" value={links} onChange={setLinks} max={5000} placeholder="One per line, like a Drive or Figma link" error={shown ? errors.links : undefined} />
      <FilesField use="delivery" maxMb={rules.deliveryMaxMb} limits={rules.limits} files={files} setFiles={setFiles} label="Files (optional)" />
      <span className={order.faint}>{`The customer then approves it or asks for changes. Files are deleted ${rules.fileDays} days after the order ends, so keep your own copy.`}</span>
      {failure && (
        <p className={order.error} role="alert">
          {failure}
        </p>
      )}
      <div className={order.actions}>
        <Button loading={busy} onClick={() => void send()}>
          Send delivery
        </Button>
        <Button variant="ghost" disabled={busy} onClick={onCancel}>
          Not now
        </Button>
      </div>
    </section>
  );
}

type Open = "decline" | "cancel" | null;

function OrderView({ item, rules, onChanged }: { item: GigOrder; rules: GigsRules; onChanged: (next: GigOrder) => void }) {
  const me = useMe();
  const isVendor = !!me?.roles.vendor;
  const [now] = useState(Date.now);
  const [open, setOpen] = useState<Open>(null);
  const [delivering, setDelivering] = useState(false);
  const [busy, setBusy] = useState<"accept" | Exclude<Open, null> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);
  const acceptKey = useRef(newIdempotencyKey());
  const keys = useRef<{ sig: string; key: string } | null>(null);
  const files = useFileOpener(
    useCallback(async () => {
      const next = await deskGigOrder(item.id);
      onChanged(next);
      return next;
    }, [item.id, onChanged]),
  );
  const status = orderStatus(item);
  const deadline = deadlineText(item, now);
  const latest = item.deliveries.at(-1);
  const asked = latest?.answer?.kind === "revision" ? latest.answer : null;
  const customer = item.customer.name;

  const accept = async () => {
    setBusy("accept");
    setError(null);
    try {
      onChanged(await acceptGigOrder(item.id, acceptKey.current));
      acceptKey.current = newIdempotencyKey();
    } catch (err) {
      setError(formError(err).message);
      if (!keepIdempotencyKey(err)) acceptKey.current = newIdempotencyKey();
    } finally {
      setBusy(null);
    }
  };

  const decide = async (kind: Exclude<Open, null>, reason: string) => {
    setBusy(kind);
    setPanelError(null);
    const sig = `${kind}|${reason}`;
    if (keys.current?.sig !== sig) keys.current = { sig, key: newIdempotencyKey() };
    try {
      onChanged(await (kind === "decline" ? declineGigOrder : deskCancelGigOrder)(item.id, reason, keys.current.key));
      keys.current = null;
      setOpen(null);
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

  return (
    <div className={order.page}>
      <Back href="/freelance/orders">Freelance orders</Back>
      <div className={order.titleRow}>
        <div className={shop.head}>
          <h1 className={order.title}>{item.title}</h1>
          <p className={order.small}>{`Order #${item.orderNo} · ${customer}`}</p>
          <p className={order.small}>{packageLine(item)}</p>
          {deadline && <p className={item.late ? order.error : order.small}>{deadline}</p>}
        </div>
        <Tag tone={status.tone}>{status.label}</Tag>
      </div>

      {item.status === "paid" && item.acceptBy && (
        <div className={order.news} role="status">
          <p className={order.small}>{`Accept by ${momentText(item.acceptBy)}, or it’s cancelled and the customer gets everything back.`}</p>
        </div>
      )}
      {item.status === "in_progress" && item.dueAt && (
        <div className={order.news}>
          <p className={order.small}>{`Deliver by ${momentText(item.dueAt)}. Late orders can be cancelled by the customer.`}</p>
        </div>
      )}
      {item.status === "delivered" && item.autoCompleteAt && (
        <div className={order.news}>
          <p className={order.small}>{`Waiting for the customer. It completes by itself on ${momentText(item.autoCompleteAt)}.`}</p>
        </div>
      )}
      {asked && item.status === "in_progress" && (
        <div className={order.news} role="status">
          <p className={order.small}>{`The customer asked for changes: ${asked.note ?? ""}`}</p>
        </div>
      )}
      {item.cancellation && (
        <div className={order.news}>
          <p className={order.small}>{`Cancelled by ${CANCELLED_BY[item.cancellation.by]}: ${item.cancellation.reason}`}</p>
        </div>
      )}
      {item.dispute && (
        <div className={order.news} role="status">
          <p className={order.small}>
            {item.dispute.decision ? `Ruxstar decided: ${item.dispute.decision.note}` : `The customer reported a problem: ${item.dispute.reason} Ruxstar is looking at it.`}
          </p>
        </div>
      )}

      {error && (
        <p className={order.error} role="alert">
          {error}
        </p>
      )}
      {item.can.accept && (
        <Button size="lg" loading={busy === "accept"} disabled={!!busy} onClick={() => void accept()}>
          Accept and start
        </Button>
      )}
      {item.can.deliver &&
        (delivering ? (
          <DeliverForm
            item={item}
            rules={rules}
            onDelivered={(next) => {
              onChanged(next);
              setDelivering(false);
            }}
            onCancel={() => setDelivering(false)}
          />
        ) : (
          <Button size="lg" onClick={() => setDelivering(true)}>
            {item.deliveries.length ? "Deliver again" : "Deliver the work"}
          </Button>
        ))}

      <section className={order.section}>
        <h2 className={order.overline}>The brief</h2>
        <BriefCard order={item} opening={files.opening} onOpen={(fileId) => void files.open(fileId)} />
        {!item.answers.length && !item.note && !item.files.length && <p className={order.small}>The customer didn’t add a brief. Message them to ask what they need.</p>}
        <div>
          <Link href={`/messages/with/${item.customer.id}`} className={events.textLink}>
            {`Message ${customer}`}
          </Link>
        </div>
      </section>

      {item.status !== "cancelled" && item.status !== "awaiting_payment" && (
        <section className={order.section}>
          <h2 className={order.overline}>Progress</h2>
          <Timeline steps={orderTimeline(item)} />
        </section>
      )}

      {item.deliveries.length > 0 && (
        <section className={order.section}>
          <h2 className={order.overline}>Your deliveries</h2>
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
      <p className={order.small}>{`Revisions: ${item.revisions.used} of ${item.revisions.included} used.`}</p>

      <section className={order.section}>
        <h2 className={order.overline}>Earnings</h2>
        <Earnings item={item} />
        <div>
          <Link href={isVendor ? "/vendor/payments" : "/freelance/payments"} className={events.textLink}>
            Payments and withdrawals
          </Link>
        </div>
      </section>
      <InvoiceLinks refs={item.invoices} audience={isVendor ? "vendor" : "freelance"} />

      {open === "decline" ? (
        <NotePanel
          title="Decline this order?"
          message={`${customer} gets ${money(item.price.total)} back and sees your reason.`}
          prompt="Why you can’t take it"
          placeholder="Like “I’m fully booked this week”"
          min={5}
          max={300}
          confirm="Decline"
          danger
          busy={busy === "decline"}
          failure={panelError}
          onConfirm={(reason) => void decide("decline", reason)}
          onCancel={() => toggle(null)}
        />
      ) : open === "cancel" ? (
        <NotePanel
          title="Cancel this order?"
          message={`${customer} gets ${money(item.price.total)} back and sees your reason. You aren’t paid for it.`}
          prompt="Why you’re cancelling"
          placeholder="Tell the customer what happened"
          min={5}
          max={300}
          confirm="Cancel order"
          danger
          busy={busy === "cancel"}
          failure={panelError}
          onConfirm={(reason) => void decide("cancel", reason)}
          onCancel={() => toggle(null)}
        />
      ) : (
        (item.can.decline || item.can.cancel) && (
          <div>
            <button type="button" className={events.textLink} data-danger onClick={() => toggle(item.can.decline ? "decline" : "cancel")}>
              {item.can.decline ? "Decline this order" : "Cancel and refund the customer"}
            </button>
          </div>
        )
      )}
    </div>
  );
}

/** One order for the freelancer: accept or decline, the brief, delivering files and links, revisions, and what they earn. */
export function DeskGigOrderScreen({ id }: { id: string }) {
  const onSignedOut = useOnSignedOut();
  const rules = useLoad(loadGigsRules);
  const [item, setItem] = useState<GigOrder | null>(null);
  const [error, setError] = useState<unknown>(null);
  const done = item ? finished(item) : true;

  const load = useCallback(
    () =>
      deskGigOrder(id).then(
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

  if (item && rules.data) return <OrderView item={item} rules={rules.data} onChanged={setItem} />;
  const failure = error ?? rules.error;
  if (failure) {
    const gone = failure instanceof ApiError && failure.status === 404;
    return (
      <Empty title={gone ? "Order not found" : "Could not load this order"}>
        <p>{formError(failure).message}</p>
        {gone ? (
          <ButtonLink href="/freelance/orders" variant="secondary">
            Freelance orders
          </ButtonLink>
        ) : (
          <Button
            variant="secondary"
            icon={<Icon name="refresh" size={16} />}
            onClick={() => {
              void load();
              rules.reload();
            }}
          >
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
