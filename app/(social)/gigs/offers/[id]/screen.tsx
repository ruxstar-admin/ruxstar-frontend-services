"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button, ButtonLink, Icon, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { CheckoutCoupons } from "@/components/coupons/CheckoutCoupons";
import { useOffers } from "@/components/coupons/use-offers";
import { PriceLine } from "@/components/stays/pieces";
import { TextArea } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { NotePanel } from "@/components/gigs/NotePanel";
import { loadGigsRules } from "@/components/gigs/use-gigs";
import { formError } from "@/lib/api/account";
import { ApiError, keepIdempotencyKey, newIdempotencyKey } from "@/lib/api/client";
import { getQuote, payQuote, quoteOffers, withdrawQuote, type GigsRules, type QuotePayInput, type QuoteState } from "@/lib/api/gigs";
import { money } from "@/lib/api/shops";
import { daysText, orderPrice, quoteBadge, quoteNote, quoteStatus, revisionsText } from "@/lib/gigs";
import shop from "@/components/shop/shop.module.css";
import order from "@/components/shop/order.module.css";
import events from "@/components/events/events.module.css";

function Offer({ quote, rules, onChanged }: { quote: QuoteState; rules: GigsRules; onChanged: (q: QuoteState) => void }) {
  const router = useRouter();
  const [now] = useState(Date.now);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const attempt = useRef<{ sig: string; key: string } | null>(null);
  const status = quoteStatus(quote, now);
  const badge = quoteBadge(quote, now);
  const open = status === "open";
  const payable = open && quote.canPay;

  const coupon = useOffers((code) => quoteOffers(quote.id, code), payable ? quote.id : null);
  const price = orderPrice(quote.price, rules.platformFee, coupon.discount);

  const pay = async () => {
    setBusy(true);
    setFailure(null);
    const body: QuotePayInput = {
      note: note.trim() || null,
      ...(coupon.applied ? { coupon: coupon.applied.code } : {}),
      returnTo: `${window.location.origin}/orders/freelance`,
    };
    const sig = JSON.stringify([body.note, body.coupon]);
    if (attempt.current?.sig !== sig) attempt.current = { sig, key: newIdempotencyKey() };
    try {
      const placed = await payQuote(quote.id, body, attempt.current.key);
      if (placed.checkoutUrl) window.location.assign(placed.checkoutUrl);
      else router.replace(`/orders/freelance/${placed.order.id}?fresh=1`);
    } catch (err) {
      if (!keepIdempotencyKey(err)) attempt.current = null;
      if (err instanceof ApiError && err.code === "COUPON_INVALID") {
        coupon.remove();
        setFailure(`${err.message} We took the coupon off, so the total is ${money(orderPrice(quote.price, rules.platformFee).total)} now.`);
      } else setFailure(formError(err).message);
      setBusy(false);
    }
  };

  const withdraw = async () => {
    setBusy(true);
    setFailure(null);
    try {
      onChanged(await withdrawQuote(quote.id));
      setWithdrawing(false);
    } catch (err) {
      setFailure(formError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={order.page}>
      <div className={order.titleRow}>
        <div className={shop.head}>
          <span className={order.overline}>Custom offer</span>
          <h1 className={order.title}>{quote.title}</h1>
          <p className={order.small}>{`${quote.freelancer.name} · ${daysText(quote.deliveryDays)} delivery · ${revisionsText(quote.revisions)}`}</p>
        </div>
        <Tag tone={badge.tone}>{badge.label}</Tag>
      </div>

      <div className={order.panel}>
        <p className={shop.text}>{quote.description}</p>
        <strong>{money(quote.price)}</strong>
        <span className={order.faint}>{quoteNote(quote, now)}</span>
      </div>

      <div className={order.actions}>
        <Link href={`/messages/${quote.chatId}`} className={events.textLink}>
          Back to the chat
        </Link>
        <Link href={`/gigs/freelancer/${quote.freelancer.businessId}`} className={events.textLink}>
          {`See ${quote.freelancer.name}’s page`}
        </Link>
      </div>

      {status === "paid" && quote.orderId && (
        <div>
          <ButtonLink href={`/orders/freelance/${quote.orderId}`}>Open the order</ButtonLink>
        </div>
      )}

      {payable && (
        <>
          <section className={order.section}>
            <h2 className={order.overline}>Pay for this offer</h2>
            <TextArea label="Note for the freelancer (optional)" value={note} onChange={setNote} max={1000} placeholder="Anything they should know to start" />
          </section>
          <section className={order.section}>
            <h2 className={order.overline}>Coupon</h2>
            <CheckoutCoupons
              offers={coupon.offers}
              applied={coupon.applied}
              discount={price.discount}
              problem={coupon.problem}
              busy={coupon.busy}
              module="gigs"
              onApply={(code) => void coupon.apply(code)}
              onRemove={coupon.remove}
            />
          </section>
          <div className={order.panel}>
            <dl className={order.prices}>
              <PriceLine label="Offer" amount={price.items} />
              {price.discount > 0 && coupon.applied && <PriceLine label={`Coupon ${coupon.applied.code}`} amount={price.discount} minus />}
              {price.platformFee > 0 && <PriceLine label="Platform fee" amount={price.platformFee} />}
              <PriceLine label="To pay" amount={price.total} strong />
            </dl>
          </div>
          <p className={order.faint}>The work starts once you pay. You approve each delivery, or ask for changes. You’ll pay on a secure payment page.</p>
        </>
      )}

      {open && quote.canWithdraw && withdrawing && (
        <NotePanel
          title="Withdraw this offer?"
          message="They can’t pay for it once it’s withdrawn. You can send a new one."
          confirm="Withdraw"
          danger
          busy={busy}
          failure={failure}
          onConfirm={() => void withdraw()}
          onCancel={() => {
            setWithdrawing(false);
            setFailure(null);
          }}
        />
      )}
      {open && quote.canWithdraw && !withdrawing && (
        <div>
          <Button variant="secondary" onClick={() => setWithdrawing(true)}>
            Withdraw offer
          </Button>
        </div>
      )}

      {failure && !withdrawing && (
        <p className={order.error} role="alert">
          {failure}
        </p>
      )}

      {payable && (
        <div className={shop.orderBar}>
          <span className={shop.orderText}>
            <strong>{money(price.total)}</strong>
            <span className={order.faint}>{`Offer from ${quote.freelancer.name}`}</span>
          </span>
          <Button loading={busy} disabled={coupon.pricing} onClick={() => void pay()}>
            {coupon.pricing ? "Working out the price…" : `Pay ${money(price.total)}`}
          </Button>
        </div>
      )}
    </div>
  );
}

/** A custom offer from a chat: what's included and its price, then paying for it with a note and a coupon. Same as the app's pay sheet. */
export function OfferScreen({ id }: { id: string }) {
  const quote = useLoad(() => getQuote(id), id);
  const rules = useLoad(loadGigsRules);
  const error = quote.error ?? rules.error;
  if (quote.data && rules.data) return <Offer quote={quote.data} rules={rules.data} onChanged={(q) => quote.setData(q)} />;
  if (error) {
    const gone = error instanceof ApiError && (error.status === 404 || error.status === 403);
    return (
      <Empty title={gone ? "Offer not found" : "Could not load this offer"}>
        <p>{gone ? "It may be for someone else, or the link is wrong." : formError(error).message}</p>
        {gone ? (
          <ButtonLink href="/messages" variant="secondary">
            Your messages
          </ButtonLink>
        ) : (
          <Button
            variant="secondary"
            icon={<Icon name="refresh" size={16} />}
            onClick={() => {
              quote.reload();
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
