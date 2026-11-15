"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button, ButtonLink, Icon, Input } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useMe } from "@/components/social/session";
import { PriceLine, StepBar, StudentPicker } from "@/components/coaching/parts";
import { useLoad } from "@/components/vendor/use-load";
import { formError } from "@/lib/api/account";
import { ApiError, newIdempotencyKey } from "@/lib/api/client";
import { batchOffers, enrol, getCourse, type CourseDetail, type Offers } from "@/lib/api/coaching";
import { money } from "@/lib/api/shops";
import { dayLabel, dayText } from "@/lib/events";
import shop from "@/components/shop/shop.module.css";
import order from "@/components/shop/order.module.css";
import events from "@/components/events/events.module.css";
import styles from "@/components/coaching/coaching.module.css";

const STEPS = ["Batch", "Student", "Pay"] as const;

/** A coupon code the customer typed or tapped, and what the API said about it. */
function Coupon({ batchId, applied, onApply }: { batchId: string; applied: Offers["checked"]; onApply: (checked: Offers["checked"]) => void }) {
  const offers = useLoad(() => batchOffers(batchId), batchId);
  const [code, setCode] = useState(applied?.code ?? "");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const check = async (value: string) => {
    const clean = value.trim().toUpperCase();
    if (clean.length < 3) return;
    setBusy(true);
    setFailure(null);
    try {
      onApply((await batchOffers(batchId, clean)).checked);
      setCode(clean);
    } catch (err) {
      setFailure(formError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const usable = (offers.data?.offers ?? []).filter((o) => o.discount > 0 && !o.problem);
  return (
    <section className={order.section}>
      <h2 className={order.overline}>Coupon</h2>
      {usable.length > 0 && !applied && (
        <div className={events.chips} role="group" aria-label="Offers">
          {usable.map((o) => (
            <button key={o.code} type="button" className={shop.subChip} onClick={() => void check(o.code)}>
              {`${o.code} · ${money(o.discount)} off`}
            </button>
          ))}
        </div>
      )}
      {applied && !applied.problem ? (
        <div className={events.factRow}>
          <Icon name="tag" size={18} />
          <span>
            {`${applied.code} takes ${money(applied.discount)} off. `}
            <button
              type="button"
              className={events.textLink}
              onClick={() => {
                onApply(null);
                setCode("");
              }}
            >
              Remove
            </button>
          </span>
        </div>
      ) : (
        <div className={events.lookup}>
          <Input
            label="Coupon code (optional)"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={20}
            autoCapitalize="characters"
            autoComplete="off"
            error={applied?.problem ?? failure ?? undefined}
          />
          <Button variant="secondary" loading={busy} disabled={code.trim().length < 3} onClick={() => void check(code)}>
            Apply
          </Button>
        </div>
      )}
    </section>
  );
}

function Enrolling({ course, initialBatch }: { course: CourseDetail; initialBatch?: string }) {
  const router = useRouter();
  const user = useMe();
  const meName = user?.name?.trim() || "You";
  const open = course.batches.filter((b) => b.status === "open");
  const preset = open.find((b) => b.id === initialBatch)?.id;

  const [step, setStep] = useState(preset ? 1 : 0);
  const [batchId, setBatchId] = useState<string | undefined>(preset ?? (open.length === 1 ? open[0]!.id : undefined));
  const [student, setStudent] = useState<{ childId: string | null; name: string } | undefined>();
  const [coupon, setCoupon] = useState<Offers["checked"]>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const attempt = useRef(newIdempotencyKey());

  const batch = open.find((b) => b.id === batchId);
  const discount = coupon && !coupon.problem ? coupon.discount : 0;
  const items = batch?.fee ?? 0;
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
        { student: { childId: student.childId }, ...(discount ? { coupon: coupon!.code } : {}), returnTo: `${window.location.origin}/classes` },
        attempt.current,
      );
      if (checkoutUrl) window.location.assign(checkoutUrl);
      else router.replace(`/classes/${placed.id}?fresh=1`);
    } catch (err) {
      setFailure(formError(err).message);
      // An enrolment that timed out may have been placed; trying again with the same key returns it instead of holding a second seat.
      if (!(err instanceof ApiError && err.code === "NETWORK")) attempt.current = newIdempotencyKey();
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
          <p className={order.small}>Who’s this for? Their name goes on the attendance list and the certificate.</p>
          <StudentPicker meName={meName} value={student?.childId} onChange={(childId, name) => setStudent({ childId, name })} blocked={blocked} />
        </>
      )}

      {step === 2 && batch && student && (
        <>
          <div className={order.panel}>
            <span className={order.faint}>{`${batch.name} · for ${student.name}`}</span>
            <span className={order.small}>{`${batch.schedule} · starts ${dayText(batch.firstAt)}`}</span>
            <dl className={order.prices}>
              <PriceLine label={`Batch fee · ${batch.classes} classes`} amount={items} />
              {discount > 0 && <PriceLine label={`Coupon ${coupon!.code}`} amount={discount} minus />}
              {fee > 0 && <PriceLine label="Platform fee" amount={fee} />}
              <PriceLine label="Total" amount={total} strong />
            </dl>
          </div>
          {items > 0 && <Coupon batchId={batch.id} applied={coupon} onApply={setCoupon} />}
          <div className={events.factRow}>
            <Icon name="shield" size={18} />
            <span>{course.refundRule}</span>
          </div>
          {!free && <p className={order.faint}>You pay the whole fee now, on Cashfree’s secure page. The seat is held for 20 minutes while you pay.</p>}
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
          <Button loading={busy} onClick={() => void place()}>
            {free ? "Enrol for free" : `Pay ${money(total)}`}
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
        <Empty title={data.whyNot ?? "No batch is taking students right now"}>
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
