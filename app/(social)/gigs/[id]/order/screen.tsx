"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, ButtonLink, Icon } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useMe } from "@/components/social/session";
import { CheckoutCoupons } from "@/components/coupons/CheckoutCoupons";
import { useOffers } from "@/components/coupons/use-offers";
import { PriceLine } from "@/components/stays/pieces";
import { TextArea } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { FilesField, fileIdsOf, filesReady, type HeldFile } from "@/components/gigs/files";
import { loadGigsRules } from "@/components/gigs/use-gigs";
import { formError } from "@/lib/api/account";
import { ApiError, keepIdempotencyKey, newIdempotencyKey } from "@/lib/api/client";
import { getGig, gigOffers, placeGigOrder, type GigDetail, type GigOrderInput, type GigPackage, type GigsRules } from "@/lib/api/gigs";
import { money } from "@/lib/api/shops";
import { deliveryLine, orderPrice, pickPackage } from "@/lib/gigs";
import shop from "@/components/shop/shop.module.css";
import order from "@/components/shop/order.module.css";
import events from "@/components/events/events.module.css";

function Checkout({ gig, pack, rules }: { gig: GigDetail; pack: GigPackage; rules: GigsRules }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<HeldFile[]>([]);
  const [note, setNote] = useState("");
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const attempt = useRef<{ sig: string; key: string } | null>(null);

  const coupon = useOffers((code) => gigOffers(gig.id, pack.tier, code), pack.tier);
  const price = orderPrice(pack.price, gig.platformFee, coupon.discount);
  const missing = gig.questions.filter((q) => q.required && !answers[q.id]?.trim());

  const place = async () => {
    setShown(true);
    if (missing.length || !filesReady(files)) {
      setFailure(missing.length ? "Answer the questions marked as needed." : "Wait for your files to finish sending, or remove the ones that failed.");
      return;
    }
    setBusy(true);
    setFailure(null);
    const body: GigOrderInput = {
      tier: pack.tier,
      answers: gig.questions.flatMap((q) => (answers[q.id]?.trim() ? [{ questionId: q.id, answer: answers[q.id]!.trim() }] : [])),
      ...(files.length ? { fileIds: fileIdsOf(files) } : {}),
      note: note.trim() || null,
      ...(coupon.applied ? { coupon: coupon.applied.code } : {}),
      returnTo: `${window.location.origin}/orders/freelance`,
    };
    const sig = JSON.stringify(body);
    if (attempt.current?.sig !== sig) attempt.current = { sig, key: newIdempotencyKey() };
    try {
      const placed = await placeGigOrder(gig.id, body, attempt.current.key);
      if (placed.checkoutUrl) window.location.assign(placed.checkoutUrl);
      else router.replace(`/orders/freelance/${placed.order.id}?fresh=1`);
    } catch (err) {
      // An order that timed out may have been placed; the same key returns it instead of making a second.
      if (!keepIdempotencyKey(err)) attempt.current = null;
      if (err instanceof ApiError && err.code === "COUPON_INVALID") {
        coupon.remove();
        setFailure(`${err.message} We took the coupon off, so the total is ${money(orderPrice(pack.price, gig.platformFee).total)} now.`);
      } else setFailure(formError(err).message);
      setBusy(false);
    }
  };

  return (
    <div className={order.page}>
      <h1 className={order.title}>Order this gig</h1>
      <div className={order.panel}>
        <strong>{gig.title}</strong>
        <span className={order.small}>{`${pack.name} · ${deliveryLine(pack)}`}</span>
        <span className={order.small}>{`By ${gig.freelancer.name}`}</span>
      </div>
      <div>
        <Link href={`/gigs/${gig.id}`} className={events.textLink}>
          ‹ Pick another package
        </Link>
      </div>

      {gig.questions.length > 0 && (
        <section className={order.section}>
          <h2 className={order.overline}>The freelancer asks</h2>
          {gig.questions.map((q) => (
            <TextArea
              key={q.id}
              label={q.required ? q.text : `${q.text} (optional)`}
              value={answers[q.id] ?? ""}
              onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
              max={rules.limits.answer}
              error={shown && q.required && !answers[q.id]?.trim() ? "Needed" : undefined}
            />
          ))}
        </section>
      )}

      <section className={order.section}>
        <h2 className={order.overline}>Your brief</h2>
        <TextArea label="Note (optional)" value={note} onChange={setNote} max={1000} placeholder="What you need, the style you like, anything else" />
      </section>
      <FilesField use="brief" maxMb={rules.deliveryMaxMb} limits={rules.limits} files={files} setFiles={setFiles} label="Files for the freelancer (optional)" />

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
          <PriceLine label={pack.name} amount={price.items} />
          {price.discount > 0 && coupon.applied && <PriceLine label={`Coupon ${coupon.applied.code}`} amount={price.discount} minus />}
          {price.platformFee > 0 && <PriceLine label="Platform fee" amount={price.platformFee} />}
          <PriceLine label="Total" amount={price.total} strong />
        </dl>
      </div>
      {gig.rules && <p className={order.faint}>{gig.rules}</p>}
      <p className={order.faint}>You’ll pay on a secure payment page. Ruxstar holds the money until you approve the work.</p>

      {failure && (
        <p className={order.error} role="alert">
          {failure}
        </p>
      )}

      <div className={shop.orderBar}>
        <span className={shop.orderText}>
          <strong>{money(price.total)}</strong>
          <span className={order.faint}>{`${pack.name} · ${gig.freelancer.name}`}</span>
        </span>
        <Button loading={busy} disabled={coupon.pricing} onClick={() => void place()}>
          {coupon.pricing ? "Working out the price…" : `Pay ${money(price.total)}`}
        </Button>
      </div>
    </div>
  );
}

/** Ordering one package of a gig (`tier`): the freelancer's questions, a note and files for the brief, a coupon, then pay. */
export function GigCheckoutScreen({ id, tier }: { id: string; tier: string | null }) {
  const me = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const gig = useLoad(() => getGig(id), id);
  const rules = useLoad(loadGigsRules);

  useEffect(() => {
    if (me === null) router.replace(`/signin?next=${encodeURIComponent(`${pathname}${tier ? `?tier=${tier}` : ""}`)}`);
  }, [me, router, pathname, tier]);

  const error = gig.error ?? rules.error;
  if (me && gig.data && rules.data) {
    const g = gig.data;
    const pack = pickPackage(g.packages, tier);
    if (!g.canOrder || !pack) {
      return (
        <Empty title={g.whyNot ?? "This gig isn’t taking orders right now."}>
          <p>Check the gig’s page for its packages.</p>
          <ButtonLink href={`/gigs/${id}`} variant="secondary">
            Back to the gig
          </ButtonLink>
        </Empty>
      );
    }
    return <Checkout gig={g} pack={pack} rules={rules.data} />;
  }
  if (error) {
    return (
      <Empty title={error instanceof ApiError && error.status === 404 ? "Gig not found" : "Could not load this gig"}>
        <p>{formError(error).message}</p>
        <Button
          variant="secondary"
          icon={<Icon name="refresh" size={16} />}
          onClick={() => {
            gig.reload();
            rules.reload();
          }}
        >
          Try again
        </Button>
      </Empty>
    );
  }
  return (
    <div className={order.page} aria-busy>
      <div className={shop.skeletonCard} />
    </div>
  );
}
