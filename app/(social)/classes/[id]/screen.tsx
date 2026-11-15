"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, ButtonLink, Icon, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { ClassRow } from "@/components/coaching/ClassRow";
import { InvoiceLinks } from "@/components/invoices/InvoiceLinks";
import { useLoad } from "@/components/vendor/use-load";
import { formError } from "@/lib/api/account";
import { ApiError, newIdempotencyKey } from "@/lib/api/client";
import { cancelEnrolment, enrolmentMaterials, enrolmentMessages, getEnrolment, payEnrolment, type CoachingOrder } from "@/lib/api/coaching";
import { money } from "@/lib/api/shops";
import { attendanceLine, ORDER_STATUS, sizeText } from "@/lib/coaching";
import { offerWord } from "@/lib/coupons";
import { dayText, istParts, istToday, timeText } from "@/lib/events";
import { ago } from "@/lib/time";
import shop from "@/components/shop/shop.module.css";
import order from "@/components/shop/order.module.css";
import events from "@/components/events/events.module.css";
import styles from "@/components/coaching/coaching.module.css";

/** While it waits for payment, each look also asks Cashfree whether it was paid. */
const POLL_MS = 8000;
/** Classes shown before "Show all". */
const FIRST_CLASSES = 6;

/** Its own chunk: only enrolments that can have a review download it. */
const Rate = dynamic(() => import("@/components/reviews/Reviews").then((m) => m.Rate));

/** Reviews open once the first class is held; before that there's nothing to look up. */
const mayHaveReview = (o: CoachingOrder) => o.status === "confirmed" && (!!o.canReview || o.classes.some((c) => c.status === "done"));

function Materials({ orderId }: { orderId: string }) {
  const { data, error, reload } = useLoad(() => enrolmentMaterials(orderId), `m${orderId}`);
  if (error && !data)
    return (
      <p className={order.error} role="alert">
        {`${formError(error).message} `}
        <button type="button" className={events.textLink} onClick={reload}>
          Try again
        </button>
      </p>
    );
  if (!data) return null;
  return (
    <section className={order.section}>
      <h2 className={order.overline}>Notes and files</h2>
      {data.length ? (
        <ul className={order.rows}>
          {data.map((m) => (
            <li key={m.id}>
              <a href={m.url} target="_blank" rel="noreferrer" className={order.row}>
                <span className={order.rowIcon}>
                  <Icon name={m.kind === "file" ? "download" : "share"} size={20} />
                </span>
                <span className={order.rowText}>
                  <span className={order.rowTitle}>{m.title}</span>
                  <span className={order.faint}>{[m.kind === "file" ? sizeText(m.bytes) : "Link", `added ${dayText(m.addedAt)}`].filter(Boolean).join(" · ")}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className={order.small}>Notes, worksheets and links for this batch show up here.</p>
      )}
    </section>
  );
}

function Messages({ orderId }: { orderId: string }) {
  const { data } = useLoad(() => enrolmentMessages(orderId), `t${orderId}`);
  if (!data?.length) return null;
  return (
    <section className={order.section}>
      <h2 className={order.overline}>Messages from the institute</h2>
      {data.slice(0, 10).map((m) => (
        <div key={m.id} className={styles.message}>
          <p className={styles.messageText}>{m.text}</p>
          <span className={order.faint}>{`${m.author} · ${ago(m.at)}`}</span>
        </div>
      ))}
    </section>
  );
}

function EnrolmentView({ item, fresh, onChanged }: { item: CoachingOrder; fresh: boolean; onChanged: (next: CoachingOrder) => void }) {
  const [paying, setPaying] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [allClasses, setAllClasses] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now);
  const cancelKey = useRef(newIdempotencyKey());
  const status = ORDER_STATUS[item.status];
  const unpaid = item.status === "awaiting_payment";
  const confirmed = item.status === "confirmed";
  const demo = item.kind === "demo";
  const { course, batch } = item;

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(tick);
  }, []);

  const pay = async () => {
    setPaying(true);
    setError(null);
    try {
      const { checkoutUrl } = await payEnrolment(item.id, `${window.location.origin}/classes`);
      window.location.assign(checkoutUrl);
    } catch (err) {
      setError(formError(err).message);
      setPaying(false);
    }
  };

  const cancel = async () => {
    setCancelling(true);
    setError(null);
    try {
      onChanged(await cancelEnrolment(item.id, cancelKey.current));
      setConfirming(false);
    } catch (err) {
      setError(formError(err).message);
    } finally {
      setCancelling(false);
    }
  };

  const upcoming = item.classes.filter((c) => c.status === "upcoming");
  const next = upcoming[0];
  const ordered = [...upcoming, ...item.classes.filter((c) => c.status !== "upcoming").reverse()];
  const shown = allClasses ? ordered : ordered.slice(0, FIRST_CLASSES);
  const total = item.price.total;
  const a = item.attendance;

  return (
    <div className={order.page}>
      {fresh && confirmed && (
        <div className={events.wait} data-offered role="status">
          <strong>{demo ? `Demo booked for ${item.student.name}.` : `${item.student.name} is enrolled. See you in class!`}</strong>
          <p className={order.small}>Classes show in your timetable. We’ll tell you if one is moved or cancelled.</p>
        </div>
      )}

      <div className={order.titleRow}>
        <div className={shop.head}>
          <h1 className={order.title}>
            <Link href={`/courses/${course.id}`} className={events.titleLink}>
              {course.title}
            </Link>
          </h1>
          <p className={order.small}>{`${demo ? "Demo class" : batch.name} · for ${item.student.name}`}</p>
          <p className={order.small}>{demo ? `${dayText(batch.firstAt)}, ${timeText(batch.firstAt)}` : batch.schedule}</p>
          <p className={order.small}>{course.mode === "online" ? "Online" : [course.venueName, course.address].filter(Boolean).join(", ")}</p>
        </div>
        <Tag tone={status.tone}>{status.label}</Tag>
      </div>

      {unpaid && item.payBy && (
        <div className={order.news}>
          <strong>Not paid yet</strong>
          <p className={order.small}>{`Pay by ${timeText(item.payBy)} or the seat goes back.`}</p>
        </div>
      )}
      {batch.cancelled && (
        <div className={order.news}>
          <strong>Batch cancelled</strong>
          <p className={order.small}>{`The institute cancelled this batch.${batch.cancelReason ? ` ${batch.cancelReason}` : ""} Everything you paid is refunded.`}</p>
        </div>
      )}
      {course.removed && !batch.cancelled && (
        <div className={order.news}>
          <strong>Course taken down</strong>
          <p className={order.small}>Ruxstar took this course down. Classes that hadn’t started are cancelled.</p>
        </div>
      )}
      {item.status === "cancelled" && item.reason && !batch.cancelled && <p className={order.small}>{item.reason}</p>}
      {item.refund && (
        <div className={order.news}>
          <p className={order.small}>
            {item.refund.status === "done"
              ? `${money(item.refund.amount)} refunded to how you paid. Banks take up to 7 days to show it.`
              : `Refunding ${money(item.refund.amount)}…`}
          </p>
        </div>
      )}

      {error && (
        <p className={order.error} role="alert">
          {error}
        </p>
      )}

      {unpaid && (
        <Button size="lg" loading={paying} onClick={() => void pay()}>
          {`Pay ${money(total)}`}
        </Button>
      )}

      {mayHaveReview(item) && (
        <Rate
          orderId={item.id}
          module="coaching"
          open={!!item.canReview}
          until={item.reviewUntil ?? null}
          words={{
            ask: demo ? "Rate the demo class" : "Rate this course",
            askLine: `How ${demo ? "was the class" : "are the classes"}? Your review helps other students and parents choose ${item.business.name}.`,
            writeTitle: `Rate ${course.title}`,
            placeholder: "The teaching, the timings, how the institute was to deal with",
          }}
        />
      )}

      {confirmed && next && (
        <section className={order.section}>
          <h2 className={order.overline}>{demo ? "Your demo class" : "Next class"}</h2>
          <ClassRow cls={next} title={istParts(next.startsAt).day === istToday() ? "Today" : dayText(next.startsAt)} now={now} />
        </section>
      )}

      {confirmed && !demo && (
        <section className={order.section}>
          <h2 className={order.overline}>Attendance</h2>
          <div className={order.panel}>
            <strong>{attendanceLine(a)}</strong>
            <div
              className={styles.meter}
              data-good={a.percent >= a.needed || undefined}
              role="meter"
              aria-label="Attendance"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={a.percent}
            >
              <span style={{ width: `${Math.min(100, a.percent)}%` }} />
            </div>
            <span className={order.faint}>{`The certificate needs ${a.needed}% of classes.`}</span>
          </div>
        </section>
      )}

      {item.certificate && (
        <a href={item.certificate.pdfUrl} target="_blank" rel="noreferrer" className={order.row}>
          <span className={order.rowIcon}>
            <Icon name="verified" size={20} />
          </span>
          <span className={order.rowText}>
            <span className={order.rowTitle}>Certificate</span>
            <span className={order.faint}>{`Issued ${dayText(item.certificate.issuedAt)} · code ${item.certificate.code}`}</span>
          </span>
          <span className={order.rowEnd}>PDF</span>
          <Icon name="download" size={18} />
        </a>
      )}

      {confirmed && <Messages orderId={item.id} />}
      {confirmed && !demo && <Materials orderId={item.id} />}

      {item.classes.length > 0 && (
        <section className={order.section}>
          <h2 className={order.overline}>{demo ? "The class" : `Classes · ${item.classes.filter((c) => c.status !== "cancelled").length}`}</h2>
          {shown.map((c) => (
            <ClassRow key={c.id} cls={c} title={dayText(c.startsAt)} now={now} />
          ))}
          {ordered.length > FIRST_CLASSES && (
            <button type="button" className={events.textLink} onClick={() => setAllClasses(!allClasses)}>
              {allClasses ? "Show fewer" : `Show all ${ordered.length} classes`}
            </button>
          )}
        </section>
      )}

      <div className={order.panel}>
        <span className={order.faint}>{`${demo ? "Demo" : "Enrolment"} #${item.orderNo}`}</span>
        <span>
          {total
            ? `${money(total)}${unpaid ? " to pay" : ""}${item.price.platformFee ? `, including a ${money(item.price.platformFee)} platform fee` : ""}`
            : "Free"}
        </span>
        {item.price.discount > 0 && (
          <span className={order.small}>{`${money(item.price.discount)} off${item.coupon ? ` with ${item.coupon.code} · ${offerWord(item.coupon.fundedBy, "coaching")}` : ""}`}</span>
        )}
        <span className={order.faint}>{`By ${item.business.name}`}</span>
      </div>

      <InvoiceLinks refs={item.invoices} audience="customer" />

      {item.canCancel &&
        (confirming ? (
          <div className={order.news}>
            <strong>{demo ? "Cancel the demo class?" : "Cancel this enrolment?"}</strong>
            <p className={order.small}>
              {unpaid || !total
                ? "The seat goes to someone else."
                : `${item.student.name}’s seat is given up and ${money(total)} goes back to how you paid.${item.cancelUntil ? ` You can do this until ${dayText(item.cancelUntil)}, ${timeText(item.cancelUntil)}, when the first class starts.` : ""}`}
            </p>
            <div className={order.actions}>
              <Button variant="danger" loading={cancelling} onClick={() => void cancel()}>
                {demo ? "Cancel demo" : "Cancel enrolment"}
              </Button>
              <Button variant="ghost" disabled={cancelling} onClick={() => setConfirming(false)}>
                Keep it
              </Button>
            </div>
          </div>
        ) : (
          <button type="button" className={events.textLink} data-danger onClick={() => setConfirming(true)}>
            {confirmed && total ? "Cancel and get a refund" : "Cancel"}
          </button>
        ))}
      {confirmed && !item.canCancel && (
        <p className={order.faint}>{demo ? "The demo class has started, so it can’t be cancelled." : "Classes have started, so there are no refunds now."}</p>
      )}
    </div>
  );
}

/** One enrolment or demo class: every class, attendance, materials, messages, the certificate, paying and cancelling. Same as the app. */
export function EnrolmentScreen({ id, fresh }: { id: string; fresh: boolean }) {
  const onSignedOut = useOnSignedOut();
  const [item, setItem] = useState<CoachingOrder | null>(null);
  const [error, setError] = useState<unknown>(null);
  const waiting = item?.status === "awaiting_payment";

  const load = useCallback(
    () =>
      getEnrolment(id).then(
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
    if (!waiting) return;
    const timer = setInterval(() => document.visibilityState === "visible" && void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [waiting, load]);

  if (item) return <EnrolmentView item={item} fresh={fresh} onChanged={setItem} />;
  if (error) {
    const gone = error instanceof ApiError && error.status === 404;
    return (
      <Empty title={gone ? "Enrolment not found" : "Could not load this enrolment"}>
        <p>{formError(error).message}</p>
        {gone ? (
          <ButtonLink href="/classes" variant="secondary">
            Your classes
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
