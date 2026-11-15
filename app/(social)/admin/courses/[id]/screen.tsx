"use client";

import { useEffect, useRef, useState } from "react";
import { Needs, useCan } from "@/components/admin/AdminFrame";
import { Failed, Fact, ReasonForm, date, styles } from "@/components/admin/parts";
import { CoursePhoto } from "@/components/coaching/CourseCard";
import { useOnSignedOut } from "@/components/social/session";
import { Button, ButtonLink, Card, Icon, Skeleton, Tag, useToast } from "@/components/ui";
import { formError } from "@/lib/api/account";
import { newIdempotencyKey } from "@/lib/api/client";
import { getStaffCourse, takeDownCourse, type VendorCourse } from "@/lib/api/coaching";
import { money } from "@/lib/api/shops";
import { BATCH_STATUS, CATEGORY_LABEL, COURSE_STATUS, MODE_LABEL } from "@/lib/coaching";
import { dayText } from "@/lib/events";
import { ago } from "@/lib/time";
import eventStyles from "@/components/events/events.module.css";

/** Drafts and live courses can be taken down; taken-down ones can't again. */
function TakeDown({ course, onDone }: { course: VendorCourse; onDone: (next: VendorCourse, message: string) => void }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const canManage = useCan("businesses.manage");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const key = useRef(newIdempotencyKey());
  if (!canManage || course.status === "removed") return null;

  const students = course.counts.students + course.counts.demos;
  const message = students
    ? `Its batches are cancelled and it can’t take students again. Everyone whose fee hasn’t been paid out to the institute is refunded in full. The institute and every student see your reason. This can’t be undone.`
    : "It can’t take students again. Nobody has enrolled yet. The institute sees your reason. This can’t be undone.";

  async function takeDown(reason: string) {
    setBusy(true);
    try {
      const next = await takeDownCourse(course.id, reason, key.current);
      key.current = newIdempotencyKey();
      setOpen(false);
      onDone(next, students ? "Course taken down. Students are being refunded, and they and the institute have been told why." : "Course taken down. The institute has been told why.");
    } catch (err) {
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setBusy(false);
    }
  }

  if (open) {
    return (
      <ReasonForm
        prompt={`Take down ${course.title}? ${message}`}
        placeholder="For example: this course makes promises Ruxstar’s rules don’t allow."
        confirm={students ? "Take down and refund" : "Take down"}
        busy={busy}
        onCancel={() => setOpen(false)}
        onSubmit={(reason) => void takeDown(reason)}
      />
    );
  }

  return (
    <div className={styles.actions}>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Take down
      </Button>
    </div>
  );
}

/** One course for the Ruxstar team: who runs it, its batches, students and money, and taking it down. Same as the app. */
export function CourseCaseScreen({ id }: { id: string }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const canAudit = useCan("audit.view");
  const [course, setCourse] = useState<VendorCourse | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    getStaffCourse(id).then(
      (next) => live && setCourse(next),
      (err) => live && !onSignedOut(err) && setError(err),
    );
    return () => {
      live = false;
    };
  }, [id, attempt, onSignedOut]);

  const status = course ? COURSE_STATUS[course.status] : null;

  return (
    <Needs need="businesses.view">
      <div className={styles.page}>
        <div>
          <ButtonLink href="/admin/courses" variant="ghost" icon={<Icon name="arrow-left" size={18} />}>
            Courses
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
        ) : !course || !status ? (
          <Skeleton height={420} radius={16} />
        ) : (
          <Card as="section" padding="lg" className={styles.page}>
            <CoursePhoto photo={course.photo} title={course.title} className={eventStyles.poster} />
            <div className={styles.head}>
              <div>
                <h1 className={styles.title}>{course.title}</h1>
                <p className={styles.muted}>{`${CATEGORY_LABEL[course.category]} · ${MODE_LABEL[course.mode]}`}</p>
              </div>
              <div className={styles.tags}>
                <Tag tone={status.tone}>{status.label}</Tag>
              </div>
            </div>

            {course.removal && <p className={styles.note} data-tone="danger">{`Taken down by Ruxstar ${ago(course.removal.at)}: ${course.removal.reason}`}</p>}

            <dl className={styles.facts}>
              <Fact label="Institute" value={course.business.name} />
              <Fact label="Where" value={course.mode === "online" ? "Online" : [course.venue?.name, course.venue?.address, course.venue?.city].filter(Boolean).join(", ")} />
              <Fact label="Students" value={String(course.counts.students)} />
              <Fact label="Demo classes" value={course.demo ? `${course.counts.demos} booked · ${course.demo.free ? "free" : money(course.demo.fee)}` : "No demo"} />
              <Fact label="Fees taken" value={money(course.money.sales)} />
              <Fact label="Institute’s share" value={money(course.money.share)} />
              <Fact label="Commission" value={`${course.money.commissionBps / 100}%`} />
              <Fact label="Certificate at" value={`${course.certificatePercent}% attendance`} />
              {course.status === "draft" && course.missing.length > 0 && <Fact label="Missing to publish" value={course.missing.join(", ")} warn />}
              <Fact label="Published" value={course.publishedAt ? date(course.publishedAt) : "Not yet"} />
              <Fact label="Created" value={date(course.createdAt)} />
              <Fact label="Course id" value={course.id} />
            </dl>

            {course.batches.length > 0 && (
              <section className={styles.group}>
                <h2 className={styles.subtitle}>{`Batches · ${course.batches.length}`}</h2>
                <ul className={styles.list}>
                  {course.batches.map((b) => {
                    const s = BATCH_STATUS[b.status];
                    return (
                      <li key={b.id} className={styles.item}>
                        <div className={styles.row}>
                          <span className={styles.whoRow}>
                            <span className={styles.name}>{b.name}</span>
                            <span className={`${styles.muted} ${styles.line}`}>{`${b.schedule} · ${dayText(b.firstAt)} to ${dayText(b.lastEndsAt)}`}</span>
                            <span className={`${styles.muted} ${styles.line}`}>{`${b.enrolled} of ${b.capacity} enrolled · ${b.fee ? money(b.fee) : "Free"} · ${money(b.sales)} taken`}</span>
                          </span>
                          <span className={styles.tags}>
                            <Tag tone={s.tone}>{s.label}</Tag>
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {course.description && <p className={styles.text}>{course.description}</p>}

            <TakeDown
              course={course}
              onDone={(next, message) => {
                setCourse(next);
                toast(message, "success");
              }}
            />

            <div className={styles.actions}>
              <ButtonLink href={`/admin/businesses/${course.business.id}`} variant="ghost" icon={<Icon name="store" size={18} />}>
                Open the institute’s business
              </ButtonLink>
              {course.status === "live" && (
                <ButtonLink href={`/courses/${course.id}`} variant="ghost" icon={<Icon name="book" size={18} />}>
                  See it as customers do
                </ButtonLink>
              )}
              {canAudit && (
                <ButtonLink href={`/admin/audit?target=${course.id}`} variant="ghost" icon={<Icon name="clock" size={18} />}>
                  History for this course
                </ButtonLink>
              )}
            </div>
          </Card>
        )}
      </div>
    </Needs>
  );
}
