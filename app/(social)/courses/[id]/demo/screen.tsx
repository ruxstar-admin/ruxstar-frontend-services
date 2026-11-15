"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button, ButtonLink, Icon } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useMe } from "@/components/social/session";
import { PriceLine, StepBar, StudentPicker } from "@/components/coaching/parts";
import { useLoad } from "@/components/vendor/use-load";
import { formError } from "@/lib/api/account";
import { ApiError, newIdempotencyKey } from "@/lib/api/client";
import { bookDemo, getCourse, type CourseDetail } from "@/lib/api/coaching";
import { money } from "@/lib/api/shops";
import { whenLine } from "@/lib/events";
import shop from "@/components/shop/shop.module.css";
import order from "@/components/shop/order.module.css";
import events from "@/components/events/events.module.css";
import styles from "@/components/coaching/coaching.module.css";

const STEPS = ["Class", "Student", "Confirm"] as const;

function Booking({ course }: { course: CourseDetail }) {
  const router = useRouter();
  const user = useMe();
  const meName = user?.name?.trim() || "You";
  const demo = course.demo!;
  const [step, setStep] = useState(0);
  const [sessionId, setSessionId] = useState<string | undefined>(course.demoClasses.length === 1 ? course.demoClasses[0]!.sessionId : undefined);
  const [student, setStudent] = useState<{ childId: string | null; name: string } | undefined>();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const attempt = useRef(newIdempotencyKey());

  const picked = course.demoClasses.find((c) => c.sessionId === sessionId);
  const fee = demo.fee > 0 ? course.platformFee : 0;
  const total = demo.fee + fee;

  const blocked = (childId: string | null) => {
    if (course.demoTaken.some((s) => s.childId === childId)) return "Had a demo for this course already";
    if (course.myOrders.some((o) => o.kind === "batch" && o.status === "confirmed" && o.student.childId === childId)) return "Already enrolled";
    return null;
  };

  const go = (next: number) => {
    setStep(next);
    setFailure(null);
    window.scrollTo({ top: 0 });
  };

  const place = async () => {
    if (!picked || !student) return;
    setBusy(true);
    setFailure(null);
    try {
      const { order: placed, checkoutUrl } = await bookDemo(
        course.id,
        { sessionId: picked.sessionId, student: { childId: student.childId }, returnTo: `${window.location.origin}/classes` },
        attempt.current,
      );
      if (checkoutUrl) window.location.assign(checkoutUrl);
      else router.replace(`/classes/${placed.id}?fresh=1`);
    } catch (err) {
      setFailure(formError(err).message);
      if (!(err instanceof ApiError && err.code === "NETWORK")) attempt.current = newIdempotencyKey();
      setBusy(false);
    }
  };

  return (
    <div className={order.page}>
      <div className={shop.head}>
        <h1 className={order.title}>{`Demo class · ${course.title}`}</h1>
        <p className={order.small}>{demo.free ? "Free. One demo per student." : `${money(demo.fee)}. One demo per student.`}</p>
      </div>
      <StepBar steps={STEPS} at={step} />
      {step > 0 && (
        <button type="button" className={events.textLink} onClick={() => go(step - 1)}>
          ‹ Back a step
        </button>
      )}

      {step === 0 && (
        <>
          <p className={order.small}>{`Pick a class to try. ${demo.free ? "It’s free." : `It costs ${money(demo.fee)}.`} One demo per student for this course.`}</p>
          <ul className={styles.choices} role="radiogroup" aria-label="Class">
            {course.demoClasses.map((c) => (
              <li key={c.sessionId}>
                <button type="button" role="radio" className={styles.choice} aria-checked={sessionId === c.sessionId} onClick={() => setSessionId(c.sessionId)}>
                  <span className={styles.radio} aria-hidden />
                  <span className={styles.choiceText}>
                    <span className={styles.choiceTitle}>{whenLine(c.startsAt, c.endsAt)}</span>
                    <span className={order.small}>{`${c.batchName} · ${c.seatsLeft === 1 ? "1 demo seat left" : `${c.seatsLeft} demo seats left`}`}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {step === 1 && (
        <>
          <p className={order.small}>Who is this for? Add your child once and pick them every time.</p>
          <StudentPicker meName={meName} value={student?.childId} onChange={(childId, name) => setStudent({ childId, name })} blocked={blocked} />
        </>
      )}

      {step === 2 && picked && student && (
        <>
          <div className={order.panel}>
            <span className={order.faint}>{`${picked.batchName} · for ${student.name}`}</span>
            <span className={order.small}>{whenLine(picked.startsAt, picked.endsAt)}</span>
            <dl className={order.prices}>
              <PriceLine label="Demo class" amount={demo.fee} />
              {fee > 0 && <PriceLine label="Platform fee" amount={fee} />}
              <PriceLine label="Total" amount={total} strong />
            </dl>
          </div>
          <div className={events.factRow}>
            <Icon name="shield" size={18} />
            <span>
              {total ? "Full refund if you cancel before the class. If the class is cancelled, you get it all back." : "Cancel any time before the class so someone else can come."}
            </span>
          </div>
          {total > 0 && <p className={order.faint}>You’ll pay on Cashfree’s secure page. The seat is held for 20 minutes while you pay.</p>}
        </>
      )}

      {failure && (
        <p className={order.error} role="alert">
          {failure}
        </p>
      )}

      <div className={shop.orderBar}>
        <span className={shop.orderText}>
          <strong>{total ? money(total) : "Free"}</strong>
          <span className={order.faint}>{STEPS[step]}</span>
        </span>
        {step === 0 ? (
          <Button disabled={!picked} onClick={() => go(1)}>
            Continue
          </Button>
        ) : step === 1 ? (
          <Button disabled={student === undefined || !!blocked(student.childId)} onClick={() => go(2)}>
            Continue
          </Button>
        ) : (
          <Button loading={busy} onClick={() => void place()}>
            {total ? `Pay ${money(total)}` : "Book the free demo"}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Booking one demo class for yourself or a child: pick a class, who's coming, then confirm or pay. Same as the app. */
export function DemoScreen({ id }: { id: string }) {
  const { data, error, reload } = useLoad(() => getCourse(id), id);
  if (data) {
    if (!data.demo || !data.demoClasses.length || data.status !== "live") {
      return (
        <Empty title={data.demo ? "No demo classes have seats right now." : "This course has no demo class"}>
          <p>{data.demo ? "Check back soon, or enrol in a batch." : "You can still enrol in a batch."}</p>
          <ButtonLink href={`/courses/${id}`} variant="secondary">
            Back to the course
          </ButtonLink>
        </Empty>
      );
    }
    return <Booking course={data} />;
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
