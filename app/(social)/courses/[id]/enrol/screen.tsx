"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button, ButtonLink, Icon } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useMe } from "@/components/social/session";
import { PriceLine, StepBar, StudentPicker } from "@/components/coaching/parts";
import { CheckoutCoupons } from "@/components/coupons/CheckoutCoupons";
import { useOffers } from "@/components/coupons/use-offers";
import { useLoad } from "@/components/vendor/use-load";
import { formError } from "@/lib/api/account";
import { keepIdempotencyKey, newIdempotencyKey } from "@/lib/api/client";
import { batchOffers, enrol, getCourse, type CourseDetail } from "@/lib/api/coaching";
import { money } from "@/lib/api/shops";
import { dayLabel, dayText } from "@/lib/events";
import shop from "@/components/shop/shop.module.css";
import order from "@/components/shop/order.module.css";
import events from "@/components/events/events.module.css";
import styles from "@/components/coaching/coaching.module.css";

const STEPS = ["Batch", "Student", "Pay"] as const;

function Enrolling({ course, initialBatch }: { course: CourseDetail; initialBatch?: string }) {
  const router = useRouter();
  const user = useMe();
  const meName = user?.name?.trim() || "You";
  const open = course.batches.filter((b) => b.status === "open");
  const preset = open.find((b) => b.id === initialBatch)?.id;

  const [step, setStep] = useState(preset ? 1 : 0);
  const [batchId, setBatchId] = useState<string | undefined>(preset ?? (open.length === 1 ? open[0]!.id : undefined));
  const [student, setStudent] = useState<{ childId: string | null; name: string } | undefined>();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const attempt = useRef(newIdempotencyKey());

  const batch = open.find((b) => b.id === batchId);
  const items = batch?.fee ?? 0;
  const coupon = useOffers((code) => batchOffers(batch!.id, code), step === 2 && batch && items > 0 ? batch.id : null);
  const discount = items > 0 ? Math.min(coupon.discount, items) : 0;
  const fee = items > 0 ? course.platformFee : 0;
  const total = Math.max(0, items - discount) + fee;
  const free = total === 0;

  const blocked = (childId: string | null) =>
    course.myOrders.some((o) => o.kind === "batch" && o.status !== "cancelled" && o.batchId === batchId && o.student.childId === childId) ? "Already in this batch" : null;

  const go = (next: number) => {
    setStep(next);
    setFailure(null);
    window.scrollTo({ top: 0 });
  };

  const place = async () => {
    if (!batch || !student) return;
    setBusy(true);
    setFailure(null);
    try {
      const { order: placed, checkoutUrl } = await enrol(
        batch.id,
        { student: { childId: student.childId }, ...(discount && coupon.applied ? { coupon: coupon.applied.code } : {}), returnTo: `${window.location.origin}/classes` },
        attempt.current,
      );
      if (checkoutUrl) window.location.assign(checkoutUrl);
      else router.replace(`/classes/${placed.id}?fresh=1`);
    } catch (err) {
      setFailure(formError(err).message);
      // An enrolment that timed out may have been placed; trying again with the same key returns it instead of holding a second seat.
      if (!keepIdempotencyKey(err)) attempt.current = newIdempotencyKey();
      setBusy(false);
    }
  };

  return (
    <div className={order.page}>
      <div className={shop.head}>
        <h1 className={order.title}>{course.title}</h1>
        <p className={order.small}>{`By ${course.business.name}`}</p>
      </div>
      <StepBar steps={STEPS} at={step} />
      {step > 0 && (
        <button type="button" className={events.textLink} onClick={() => go(step - 1)}>
          ‹ Back a step
        </button>
      )}

      {step === 0 && <p className={order.small}>Pick a batch. You pay the whole course fee now.</p>}
      {step === 0 && (
        <ul className={styles.choices} role="radiogroup" aria-label="Batch">
          {open.map((b) => (
            <li key={b.id}>
              <button type="button" role="radio" className={styles.choice} aria-checked={batchId === b.id} onClick={() => setBatchId(b.id)}>
                <span className={styles.radio} aria-hidden />
                <span className={styles.choiceText}>
                  <span className={styles.choiceTitle}>{b.name}</span>
                  <span className={order.small}>{b.schedule}</span>
                  <span className={order.faint}>{`Starts ${dayLabel(b.startDate)} · ${b.classes} classes · ${b.seatsLeft} seats left`}</span>
                </span>
                <span className={shop.price}>{b.fee === 0 ? "Free" : money(b.fee)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {step === 1 && (
        <>
          <p className={order.small}>Who is this for? Add your child once and pick them every time.</p>
          <StudentPicker meName={meName} value={student?.childId} onChange={(childId, name) => setStudent({ childId, name })} blocked={blocked} />
        </>
      )}

      {step === 2 && batch && student && (
        <>
          <div className={order.panel}>
            <span className={order.faint}>{`${batch.name} · for ${student.name}`}</span>
            <span className={order.small}>{`${batch.schedule} · starts ${dayText(batch.firstAt)}`}</span>
            <dl className={order.prices}>
              <PriceLine label="Course fee" amount={items} />
              {discount > 0 && coupon.applied && <PriceLine label={`Coupon ${coupon.applied.code}`} amount={discount} minus />}
              {fee > 0 && <PriceLine label="Platform fee" amount={fee} />}
              <PriceLine label="Total" amount={total} strong />
            </dl>
          </div>
          {items > 0 && (
            <section className={order.section}>
              <h2 className={order.overline}>Coupon</h2>
              <CheckoutCoupons
                offers={coupon.offers}
                applied={coupon.applied}
                discount={discount}
                problem={coupon.problem}
                busy={coupon.busy}
                module="coaching"
                onApply={(code) => void coupon.apply(code)}
                onRemove={coupon.remove}
              />
            </section>
          )}
          <div className={events.factRow}>
            <Icon name="shield" size={18} />
            <span>{course.refundRule}</span>
          </div>
          {!free && <p className={order.faint}>You’ll pay on Cashfree’s secure page. The seat is held for 20 minutes while you pay.</p>}
        </>
      )}

      {failure && (
        <p className={order.error} role="alert">
          {failure}
        </p>
      )}

      <div className={shop.orderBar}>
        <span className={shop.orderText}>
          <strong>{batch ? (free ? "Free" : money(total)) : "Pick a batch"}</strong>
          <span className={order.faint}>{batch ? batch.name : STEPS[step]}</span>
        </span>
        {step === 0 ? (
          <Button disabled={!batch} onClick={() => go(1)}>
            Continue
          </Button>
        ) : step === 1 ? (
          <Button disabled={student === undefined || !!blocked(student.childId)} onClick={() => go(2)}>
            Continue
          </Button>
        ) : (
          <Button loading={busy} disabled={coupon.pricing} onClick={() => void place()}>
            {coupon.pricing ? "Working out the price…" : free ? "Enrol for free" : `Pay ${money(total)}`}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Enrolling yourself or a child: pick a batch, who it's for, then pay the whole fee. Free batches are confirmed straight away. Same as the app. */
export function EnrolScreen({ id, batchId }: { id: string; batchId?: string }) {
  const { data, error, reload } = useLoad(() => getCourse(id), id);
  if (data) {
    if (!data.canEnrol || !data.batches.some((b) => b.status === "open")) {
      return (
        <Empty title={data.whyNot ?? "No batches are taking students right now."}>
          <p>Check the course page for its batches and demo classes.</p>
          <ButtonLink href={`/courses/${id}`} variant="secondary">
            Back to the course
          </ButtonLink>
        </Empty>
      );
    }
    return <Enrolling course={data} initialBatch={batchId} />;
  }
  if (error) {
    return (
      <Empty title="Could not load this course">
        <p>{formError(error).message}</p>
        <Button variant="secondary" icon={<Icon name="refresh" size={16} />} onClick={reload}>
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
