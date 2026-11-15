"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, ButtonLink, Icon, Tag, type IconName } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { CoursePhoto } from "@/components/coaching/CourseCard";
import { WeekDays } from "@/components/coaching/parts";
import { Back, Failed, Loading, TextArea } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { formError } from "@/lib/api/account";
import { ApiError, keepIdempotencyKey, newIdempotencyKey } from "@/lib/api/client";
import { cancelBatch, deleteBatch, deleteCourse, getVendorCourse, publishCourse, setCoursePhoto, type VendorBatch, type VendorCourse } from "@/lib/api/coaching";
import { money } from "@/lib/api/shops";
import { BATCH_STATUS, CATEGORY_LABEL, COURSE_STATUS, placeLine } from "@/lib/coaching";
import { dayText, timeText } from "@/lib/events";
import { shrinkPhoto } from "@/lib/photo";
import vendor from "@/components/vendor/vendor.module.css";
import events from "@/components/events/events.module.css";
import styles from "@/components/coaching/coaching.module.css";

/** Course photos are 16:9 on the card; the API keeps them within 1440 px. */
const PHOTO_SIDE = 1440;
const PHOTO_ASPECT = 16 / 9;

function Row({ href, icon, title, subtitle }: { href: string; icon: IconName; title: string; subtitle: string }) {
  return (
    <li>
      <Link href={href} className={vendor.row}>
        <Icon name={icon} size={20} />
        <span className={vendor.rowText}>
          <span className={vendor.rowTitle}>{title}</span>
          <span className={vendor.rowLine}>{subtitle}</span>
        </span>
        <Icon name="chevron-right" size={18} />
      </Link>
    </li>
  );
}

function BatchCard({ course, batch, onChanged }: { course: VendorCourse; batch: VendorBatch; onChanged: (c: VendorCourse) => void }) {
  const [mode, setMode] = useState<"cancel" | "delete" | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const key = useRef(newIdempotencyKey());
  const status = BATCH_STATUS[batch.status];
  const before = batch.status === "open" || batch.status === "full";
  const booked = batch.enrolled + batch.held;
  const coaches = batch.coaches.map((c) => c.name).join(", ");

  const run = async (action: () => Promise<VendorCourse>) => {
    setBusy(true);
    setFailure(null);
    try {
      onChanged(await action());
      setMode(null);
    } catch (err) {
      setFailure(formError(err).message);
      if (!keepIdempotencyKey(err)) key.current = newIdempotencyKey();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={styles.batch} data-closed={batch.status === "cancelled" || batch.status === "ended" || undefined}>
      <div className={styles.batchHead}>
        <span className={styles.batchName}>{batch.name}</span>
        <Tag tone={status.tone}>{status.label}</Tag>
      </div>
      <span className={vendor.muted}>{batch.schedule}</span>
      <WeekDays slots={batch.slots} />
      <span className={vendor.muted}>{`${dayText(batch.firstAt)} to ${dayText(batch.lastEndsAt)} · ${batch.classes} ${batch.classes === 1 ? "class" : "classes"}`}</span>
      <span className={vendor.muted}>
        {`${batch.enrolled} of ${batch.capacity} enrolled${batch.held ? ` · ${batch.held} paying now` : ""} · ${batch.fee ? money(batch.fee) : "Free"}${batch.sales ? ` · ${money(batch.sales)} taken` : ""}`}
      </span>
      {coaches && <span className={vendor.muted}>{`Coaches: ${coaches}`}</span>}
      {batch.minStudents && batch.minimumBy && before && (
        <span className={vendor.faint}>{`Needs ${batch.minStudents} students by ${dayText(batch.minimumBy)}, ${timeText(batch.minimumBy)}, or it’s cancelled and everyone refunded.`}</span>
      )}
      {batch.cancelReason && <span className={vendor.faint}>{`Cancelled: ${batch.cancelReason}`}</span>}
      {batch.certificatesAt && <span className={vendor.faint}>{`Certificates issued ${dayText(batch.certificatesAt)}`}</span>}

      {failure && (
        <p className={vendor.error} role="alert">
          {failure}
        </p>
      )}

      {mode === "cancel" ? (
        <div className={vendor.form}>
          <p className={vendor.muted}>
            {booked
              ? `Every class is cancelled and all ${booked} students get a full refund, platform fee included. This can’t be undone.`
              : "Every class is cancelled and it stops taking students. This can’t be undone."}
          </p>
          <TextArea label="Tell students and parents why" value={reason} onChange={setReason} max={300} placeholder="Like “Not enough students for this timing”" />
          <div className={vendor.actions}>
            <Button variant="danger" loading={busy} disabled={reason.trim().length < 5} onClick={() => void run(() => cancelBatch(batch.id, reason.trim(), key.current))}>
              Cancel batch
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setMode(null)}>
              Keep it
            </Button>
          </div>
        </div>
      ) : mode === "delete" ? (
        <div className={vendor.form}>
          <p className={vendor.muted}>{`${batch.name} and its classes are deleted. No one has enrolled yet.`}</p>
          <div className={vendor.actions}>
            <Button variant="danger" loading={busy} onClick={() => void run(() => deleteBatch(batch.id))}>
              Delete
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setMode(null)}>
              Keep it
            </Button>
          </div>
        </div>
      ) : (
        <div className={styles.batchFoot}>
          {course.status !== "removed" && batch.status !== "cancelled" && batch.status !== "ended" && (
            <ButtonLink href={`/vendor/courses/${course.id}/batches/${batch.id}`} variant="secondary" icon={<Icon name="edit" size={16} />}>
              Edit batch
            </ButtonLink>
          )}
          {course.status === "live" && batch.status !== "cancelled" && (
            <ButtonLink href={`/teach/batches/${batch.id}`} variant="secondary" icon={<Icon name="book" size={16} />}>
              Classes and materials
            </ButtonLink>
          )}
          {before && booked === 0 && batch.sales === 0 ? (
            <button type="button" className={vendor.link} data-muted onClick={() => setMode("delete")}>
              Delete this batch
            </button>
          ) : (
            before &&
            course.status !== "removed" && (
              <button type="button" className={vendor.link} data-muted onClick={() => setMode("cancel")}>
                Cancel this batch
              </button>
            )
          )}
        </div>
      )}
    </section>
  );
}

function Dashboard({ course, setCourse, reload, fresh }: { course: VendorCourse; setCourse: (c: VendorCourse) => void; reload: () => void; fresh: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const publishKey = useRef(newIdempotencyKey());
  const status = COURSE_STATUS[course.status];
  const draft = course.status === "draft";
  const removed = course.status === "removed";
  const list = `/vendor/businesses/${course.business.id}/courses`;
  const batches = [...course.batches].sort((a, b) => Number(a.status === "cancelled" || a.status === "ended") - Number(b.status === "cancelled" || b.status === "ended"));

  const run = async (name: string, action: () => Promise<VendorCourse>) => {
    setBusy(name);
    setFailure(null);
    try {
      setCourse(await action());
    } catch (err) {
      setFailure(err instanceof ApiError ? formError(err).message : "That file is not a photo we can read.");
      reload();
    } finally {
      setBusy(null);
    }
  };

  const photo = (picked: File) => void run("photo", async () => setCoursePhoto(course.id, await shrinkPhoto(picked, PHOTO_SIDE, PHOTO_ASPECT)));

  const remove = async () => {
    setBusy("delete");
    try {
      await deleteCourse(course.id);
      router.replace(list);
    } catch (err) {
      setBusy(null);
      setDeleting(false);
      setFailure(formError(err).message);
    }
  };

  return (
    <div className={vendor.page}>
      <Back href={list}>Courses</Back>

      {fresh && draft && (
        <p className={vendor.note}>
          <Icon name="check" size={20} />
          <span>Saved as a draft. Add a photo and a batch with its timetable, then publish.</span>
        </p>
      )}

      <div className={events.posterEdit}>
        <CoursePhoto photo={course.photo} title={course.title} eager className={events.poster} />
        {!removed && (
          <div>
            <input
              ref={file}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const picked = e.target.files?.[0];
                e.target.value = "";
                if (picked) photo(picked);
              }}
            />
            <Button variant="secondary" icon={<Icon name="image" size={16} />} loading={busy === "photo"} onClick={() => file.current?.click()}>
              {course.photo ? "Change photo" : "Add a photo"}
            </Button>
          </div>
        )}
      </div>

      <div className={vendor.head}>
        <div className={vendor.identity}>
          <h1 className={vendor.title}>{course.title}</h1>
          <span className={vendor.muted}>{`${CATEGORY_LABEL[course.category]} · ${placeLine(course)}`}</span>
          <span className={vendor.muted}>
            {course.demo ? `${course.demo.free ? "Free demo" : `Demo ${money(course.demo.fee)}`}${course.demoSeats ? `, ${course.demoSeats} per class` : ""}` : "No demo class"}
            {` · certificate at ${course.certificatePercent}%`}
          </span>
        </div>
        <Tag tone={status.tone}>{status.label}</Tag>
      </div>

      {course.removal && (
        <p className={vendor.note} data-tone="danger">
          <Icon name="alert" size={20} />
          <span>{`Ruxstar took this course down: ${course.removal.reason} Students whose classes hadn’t started are refunded in full.`}</span>
        </p>
      )}

      {draft && course.missing.length > 0 && (
        <div className={vendor.note}>
          <Icon name="info" size={20} />
          <div>
            <strong>Before you can publish</strong>
            <ul className={events.qList}>
              {course.missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {failure && (
        <p className={vendor.error} role="alert">
          {failure}
        </p>
      )}

      {draft && (
        <div className={vendor.actions}>
          <Button size="lg" loading={busy === "publish"} disabled={course.missing.length > 0} onClick={() => void run("publish", () => publishCourse(course.id, publishKey.current))}>
            Publish course
          </Button>
        </div>
      )}

      {!draft && (
        <section className={vendor.card}>
          <dl className={vendor.stats}>
            <div>
              <dt>Students</dt>
              <dd>{course.counts.students}</dd>
            </div>
            <div>
              <dt>Demos</dt>
              <dd>{course.counts.demos}</dd>
            </div>
            <div>
              <dt>Your share</dt>
              <dd>{money(course.money.share)}</dd>
            </div>
          </dl>
          <span className={vendor.faint}>Each student’s fee is paid out after their first class.</span>
        </section>
      )}

      <div className={vendor.spread}>
        <h2 className={vendor.section}>Batches</h2>
        {!removed && (
          <ButtonLink href={`/vendor/courses/${course.id}/batches/new`} variant="secondary" icon={<Icon name="plus" size={16} />}>
            Add a batch
          </ButtonLink>
        )}
      </div>
      {batches.length ? (
        batches.map((b) => <BatchCard key={b.id} course={course} batch={b} onChanged={setCourse} />)
      ) : (
        <p className={vendor.muted}>A batch is a group with its own fee, seats and weekly timetable. Add at least one.</p>
      )}

      <ul className={vendor.rows}>
        {!draft && (
          <Row href={`/vendor/courses/${course.id}/students`} icon="users" title="Students" subtitle="Who enrolled, for whom, and their attendance" />
        )}
        {!removed && <Row href={`/vendor/courses/${course.id}/edit`} icon="edit" title="Edit details" subtitle="Name, subject, place, demo class and certificate" />}
        {!draft && <Row href="/teach" icon="calendar" title="Today’s classes" subtitle="Take attendance, move or cancel a class" />}
        {!draft && <Row href={`/vendor/businesses/${course.business.id}/team`} icon="shield" title="Coaches" subtitle="Invite coaches to your team and choose what they can do" />}
      </ul>

      {deleting ? (
        <section className={vendor.card}>
          <h2 className={vendor.section}>Delete this draft?</h2>
          <p className={vendor.muted}>{`${course.title} and its batches will be deleted. This can’t be undone.`}</p>
          <div className={vendor.actions}>
            <Button variant="danger" loading={busy === "delete"} onClick={() => void remove()}>
              Delete
            </Button>
            <Button variant="ghost" disabled={busy === "delete"} onClick={() => setDeleting(false)}>
              Keep it
            </Button>
          </div>
        </section>
      ) : (
        draft &&
        course.counts.students === 0 && (
          <div className={vendor.actions}>
            <button type="button" className={vendor.link} data-muted onClick={() => setDeleting(true)}>
              Delete this draft
            </button>
          </div>
        )
      )}
    </div>
  );
}

/** An institute's course: photo, publishing, batches with their timetable and seats, money, and the way to students and classes. */
export function ManageCourseScreen({ id, fresh }: { id: string; fresh: boolean }) {
  const { data, error, reload, setData } = useLoad(() => getVendorCourse(id), id);

  useEffect(() => {
    const onShow = () => document.visibilityState === "visible" && reload();
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, [reload]);

  if (data) return <Dashboard course={data} setCourse={setData} reload={reload} fresh={fresh} />;
  if (error) {
    if (error instanceof ApiError && error.status === 404) {
      return (
        <Empty title="Course not found">
          <ButtonLink href="/vendor/businesses" variant="secondary">
            Businesses
          </ButtonLink>
        </Empty>
      );
    }
    return <Failed error={error} onRetry={reload} />;
  }
  return <Loading rows={5} />;
}
