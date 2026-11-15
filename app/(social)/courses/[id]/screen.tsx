"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, ButtonLink, Icon, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useMe, useSignInFirst } from "@/components/social/session";
import { CoursePhoto } from "@/components/coaching/CourseCard";
import { WeekDays } from "@/components/coaching/parts";
import { formError, isSignedOut } from "@/lib/api/account";
import { ApiError } from "@/lib/api/client";
import { getCourse, type BatchView, type CourseDetail, type PublicCourse } from "@/lib/api/coaching";
import { money } from "@/lib/api/shops";
import { BATCH_STATUS, CATEGORY_LABEL, MODE_LABEL, feeLine } from "@/lib/coaching";
import { dayLabel, dayText, mapsUrl, timeText } from "@/lib/events";
import shop from "@/components/shop/shop.module.css";
import order from "@/components/shop/order.module.css";
import events from "@/components/events/events.module.css";
import styles from "@/components/coaching/coaching.module.css";

/** Shown as "4 seats left" once this few remain. */
const FEW_LEFT = 5;

function Fact({ icon, title, detail }: { icon: "calendar" | "map-pin" | "play" | "verified" | "users"; title: string; detail?: string | null }) {
  return (
    <div className={events.factRow}>
      <Icon name={icon} size={18} />
      <span className={events.factText}>
        <strong>{title}</strong>
        {detail && <span className={order.small}>{detail}</span>}
      </span>
    </div>
  );
}

function BatchCard({ batch, courseId, canEnrol }: { batch: BatchView; courseId: string; canEnrol: boolean }) {
  const status = BATCH_STATUS[batch.status];
  const open = batch.status === "open";
  return (
    <li className={styles.batch} data-closed={!open || undefined}>
      <div className={styles.batchHead}>
        <span className={styles.batchName}>{batch.name}</span>
        <Tag tone={status.tone}>{status.label}</Tag>
      </div>
      <span className={order.small}>{batch.schedule}</span>
      <WeekDays slots={batch.slots} />
      <span className={order.small}>
        {`Starts ${dayLabel(batch.startDate)} · ${batch.classes} ${batch.classes === 1 ? "class" : "classes"} · ends ${dayText(batch.lastEndsAt)}`}
      </span>
      {batch.coaches.length > 0 && <span className={order.faint}>{`Taught by ${batch.coaches.map((c) => c.name).join(", ")}`}</span>}
      {batch.minStudents && open && <span className={order.faint}>{`Runs with at least ${batch.minStudents} students. If it doesn’t, everyone gets a full refund.`}</span>}
      {batch.status === "cancelled" && batch.cancelReason && <span className={order.faint}>{batch.cancelReason}</span>}
      <div className={styles.batchFoot}>
        <span>
          <span className={styles.fee}>{batch.fee === 0 ? "Free" : money(batch.fee)}</span>
          {open && (
            <span className={events.seats} data-low={batch.seatsLeft <= FEW_LEFT || undefined}>
              {` · ${batch.seatsLeft <= FEW_LEFT ? `Only ${batch.seatsLeft} ${batch.seatsLeft === 1 ? "seat" : "seats"} left` : `${batch.seatsLeft} seats left`}`}
            </span>
          )}
        </span>
        {open && canEnrol && (
          <ButtonLink href={`/courses/${courseId}/enrol?batch=${batch.id}`} variant="secondary">
            Enrol
          </ButtonLink>
        )}
      </div>
    </li>
  );
}

function CourseView({ course, mine, signedOut }: { course: PublicCourse; mine: CourseDetail | null; signedOut: boolean }) {
  const signIn = useSignInFirst();
  const myOrders = (mine?.myOrders ?? []).filter((o) => o.status !== "cancelled");
  const openBatches = course.batches.filter((b) => b.status === "open");
  const canEnrol = !!mine?.canEnrol;
  const batchName = (id: string) => course.batches.find((b) => b.id === id)?.name ?? "";

  const action = (() => {
    if (course.status !== "live") return null;
    if (signedOut) return <Button onClick={signIn}>Sign in to enrol</Button>;
    if (!mine) return null;
    if (!canEnrol) return <Button disabled>{course.whyNot ?? "Not taking students"}</Button>;
    return <ButtonLink href={`/courses/${course.id}/enrol`}>{myOrders.some((o) => o.kind === "batch") ? "Enrol someone else" : "Enrol"}</ButtonLink>;
  })();

  return (
    <div className={order.page}>
      <CoursePhoto photo={course.photo} title={course.title} eager dimmed={course.status !== "live"} className={events.poster} />
      <div className={shop.head}>
        <div className={styles.tags}>
          <Tag>{CATEGORY_LABEL[course.category]}</Tag>
          <Tag>{MODE_LABEL[course.mode]}</Tag>
        </div>
        <h1 className={events.eventTitle}>{course.title}</h1>
        <p className={events.byLine}>{`By ${course.business.name}`}</p>
      </div>

      {course.status === "removed" ? (
        <div className={order.news} role="status">
          <strong>Taken down</strong>
          <p className={order.small}>Ruxstar took this course down. What you paid is refunded.</p>
        </div>
      ) : course.status === "draft" ? (
        <div className={order.news} role="status">
          <strong>Draft</strong>
          <p className={order.small}>{course.whyNot ?? "This course isn’t published yet."}</p>
        </div>
      ) : null}

      {myOrders.length > 0 && (
        <ul className={order.rows}>
          {myOrders.map((o) => (
            <li key={o.id}>
              <Link href={`/classes/${o.id}`} className={order.row}>
                <span className={order.rowIcon}>
                  <Icon name={o.kind === "demo" ? "play" : "book"} size={20} />
                </span>
                <span className={order.rowText}>
                  <span className={order.rowTitle}>
                    {o.status === "awaiting_payment"
                      ? `Finish paying for ${o.student.childId ? o.student.name : "your place"}`
                      : o.kind === "demo"
                        ? `Demo class for ${o.student.childId ? o.student.name : "you"}`
                        : `${o.student.childId ? `${o.student.name} is` : "You’re"} enrolled`}
                  </span>
                  <span className={order.small}>{`${batchName(o.batchId)} · #${o.orderNo}`}</span>
                </span>
                <Icon name="chevron-right" size={18} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className={shop.panel}>
        {course.mode === "online" ? (
          <Fact icon="play" title="Online live classes" detail="The class link shows on your classes shortly before each one starts." />
        ) : (
          <Fact
            icon="map-pin"
            title={course.venue?.name ?? course.venueName ?? "In person"}
            detail={course.venue ? `${course.venue.address}, ${course.venue.city}` : null}
          />
        )}
        <Fact icon="verified" title="Certificate" detail={`Attend ${course.certificatePercent}% of the classes to get one after the last class.`} />
        {course.venue && course.mode === "offline" && (
          <a className={events.textLink} href={mapsUrl(course.venue)} target="_blank" rel="noreferrer">
            Open in maps
          </a>
        )}
      </div>

      {course.demo && course.status === "live" && (
        <section className={order.section}>
          <h2 className={order.overline}>Demo class</h2>
          <div className={events.wait}>
            <strong>{course.demo.free ? "Try a free demo class" : `Try a demo class for ${money(course.demo.fee)}`}</strong>
            <p className={order.small}>
              {course.demoClasses.length
                ? `Sit in on a real class before you enrol. One demo per student. Next: ${dayText(course.demoClasses[0]!.startsAt)}, ${timeText(course.demoClasses[0]!.startsAt)}.`
                : "No demo places in the coming classes right now. Check back soon."}
            </p>
            {course.demoClasses.length > 0 && !signedOut && mine && (
              <div>
                <ButtonLink href={`/courses/${course.id}/demo`} variant="secondary">
                  {course.demo.free ? "Book a free demo class" : `Book a demo class · ${money(course.demo.fee)}`}
                </ButtonLink>
              </div>
            )}
          </div>
        </section>
      )}

      <section className={order.section}>
        <h2 className={order.overline}>Batches</h2>
        {course.batches.length ? (
          <ul className={styles.choices}>
            {course.batches.map((b) => (
              <BatchCard key={b.id} batch={b} courseId={course.id} canEnrol={canEnrol} />
            ))}
          </ul>
        ) : (
          <p className={order.small}>No batches yet.</p>
        )}
        {openBatches.some((b) => b.fee > 0) && course.platformFee > 0 && (
          <p className={order.faint}>{`Plus a ${money(course.platformFee)} platform fee per enrolment. The whole fee is paid up front.`}</p>
        )}
        <div className={events.factRow}>
          <Icon name="shield" size={18} />
          <span>{course.refundRule}</span>
        </div>
      </section>

      {course.description && (
        <section className={order.section}>
          <h2 className={order.overline}>About</h2>
          <p className={shop.text}>{course.description}</p>
        </section>
      )}

      {action && (
        <div className={shop.orderBar}>
          <span className={shop.orderText}>
            <strong>{feeLine(course)}</strong>
            <span className={order.faint}>{course.nextStart ? `Next batch starts ${dayText(course.nextStart)}` : `${course.batches.length} batches`}</span>
          </span>
          {action}
        </div>
      )}
    </div>
  );
}

/**
 * One course: about, where, batches with their weekly times and seats left, the demo class and refunds. The page arrives
 * with the course already in it when the API shares it publicly; seats left and your enrolments always load here. Same as the app.
 */
export function CourseScreen({ id, initial }: { id: string; initial: PublicCourse | null }) {
  const me = useMe();
  const signIn = useSignInFirst();
  const [full, setFull] = useState<CourseDetail | null>(null);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(
    () =>
      getCourse(id).then(
        (c) => {
          setFull(c);
          setError(null);
        },
        (err: unknown) => setError(err),
      ),
    [id],
  );

  useEffect(() => {
    if (me === undefined || me === null) return;
    void load();
    const onShow = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, [me, load]);

  const signedOut = me === null || isSignedOut(error);
  const course = full ?? initial;
  if (course) return <CourseView course={course} mine={full} signedOut={signedOut} />;
  if (signedOut) {
    return (
      <Empty title="Sign in to see this course">
        <p>Courses and classes are for people with a Ruxstar account.</p>
        <Button onClick={signIn}>Sign in</Button>
      </Empty>
    );
  }
  if (error) {
    const gone = error instanceof ApiError && error.status === 404;
    return (
      <Empty title={gone ? "Course not found" : "Could not load this course"}>
        <p>{gone ? "It may have been taken down or the link is wrong." : formError(error).message}</p>
        {gone ? (
          <ButtonLink href="/discover?category=coaching" variant="secondary">
            Find courses
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
