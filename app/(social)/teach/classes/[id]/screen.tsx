"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, ButtonLink, Icon, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { ClassTime, type ClassTimeValue } from "@/components/coaching/ClassTime";
import { changeLine } from "@/components/coaching/ClassRow";
import { Back, Failed, Loading, TextArea } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { formError } from "@/lib/api/account";
import { ApiError, newIdempotencyKey } from "@/lib/api/client";
import { cancelClass, getDeskBatch, getRoster, markAttendance, moveClass, type DeskBatchDetail, type Roster, type RosterStudent } from "@/lib/api/coaching";
import { MARK_EARLY_MS } from "@/lib/coaching";
import { whenLine } from "@/lib/events";
import vendor from "@/components/vendor/vendor.module.css";
import styles from "@/components/coaching/coaching.module.css";

const tickedOf = (students: RosterStudent[]) => new Set(students.filter((s) => s.present === true).map((s) => s.orderId));
const unsaved = (students: RosterStudent[], ticked: Set<string>) => students.some((s) => s.present === null || s.present !== ticked.has(s.orderId));

function ClassView({ roster, batch, onRoster, reloadBatch }: { roster: Roster; batch: DeskBatchDetail | null; onRoster: (r: Roster) => void; reloadBatch: () => void }) {
  const cls = roster.class;
  const [ticked, setTicked] = useState(() => tickedOf(roster.students));
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [panel, setPanel] = useState<"move" | "cancel" | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [panelFailure, setPanelFailure] = useState<string | null>(null);
  const key = useRef(newIdempotencyKey());
  const [now] = useState(Date.now);

  const cancelled = cls.status === "cancelled";
  const upcoming = !cancelled && Date.parse(cls.startsAt) > now;
  const canChange = !!batch?.can.reschedule && upcoming;
  const dirty = unsaved(roster.students, ticked);
  const change = changeLine({ ...cls, attendance: null, joinLink: null, joinFrom: null });
  const minutes = Math.round((Date.parse(cls.endsAt) - Date.parse(cls.startsAt)) / 60_000);
  const allTicked = roster.students.length > 0 && roster.students.every((s) => ticked.has(s.orderId));

  const toggle = (orderId: string, on: boolean) =>
    setTicked((t) => {
      const next = new Set(t);
      if (on) next.add(orderId);
      else next.delete(orderId);
      return next;
    });

  const save = async () => {
    setSaving(true);
    setFailure(null);
    try {
      const fresh = await markAttendance(
        cls.id,
        roster.students.map((s) => ({ orderId: s.orderId, present: ticked.has(s.orderId) })),
      );
      onRoster(fresh);
      setTicked(tickedOf(fresh.students));
    } catch (err) {
      setFailure(formError(err).message);
    } finally {
      setSaving(false);
    }
  };

  const run = async (call: (key: string) => Promise<unknown>) => {
    setBusy(true);
    setPanelFailure(null);
    try {
      await call(key.current);
      key.current = newIdempotencyKey();
      setPanel(null);
      reloadBatch();
      onRoster(await getRoster(cls.id));
    } catch (err) {
      setPanelFailure(formError(err).message);
      if (!(err instanceof ApiError && err.code === "NETWORK")) key.current = newIdempotencyKey();
    } finally {
      setBusy(false);
    }
  };

  const move = (v: ClassTimeValue) => void run((k) => moveClass(cls.id, v, k));
  const cancel = () => void run((k) => cancelClass(cls.id, reason.trim(), k));

  const hint = cancelled
    ? null
    : roster.canMark
      ? null
      : Date.parse(cls.startsAt) - MARK_EARLY_MS > now
        ? "Attendance opens 30 minutes before the class."
        : batch && !batch.can.attendance
          ? "The owner hasn’t given you attendance. You can see who’s in the class."
          : "Attendance is closed for this class.";

  return (
    <div className={vendor.page}>
      <Back href={batch ? `/teach/batches/${batch.id}` : "/teach"}>{roster.batch.name}</Back>
      <div className={vendor.head}>
        <div className={vendor.identity}>
          <h1 className={vendor.title}>{whenLine(cls.startsAt, cls.endsAt)}</h1>
          <span className={vendor.muted}>{batch ? `${batch.course.title} · ${roster.batch.name}` : roster.batch.name}</span>
        </div>
        {cls.extra && <Tag>Extra</Tag>}
      </div>

      {change && (
        <p className={vendor.note} data-tone={cancelled ? "danger" : undefined}>
          <Icon name="alert" size={20} />
          <span>{change}</span>
        </p>
      )}
      {cls.marked && (
        <p className={vendor.note}>
          <Icon name="check" size={20} />
          <span>{`Attendance saved: ${cls.present} of ${roster.students.length} present. You can change it.`}</span>
        </p>
      )}
      {hint && <p className={vendor.muted}>{hint}</p>}
      {batch?.onlineLink && upcoming && (
        <div className={vendor.actions}>
          <ButtonLink href={batch.onlineLink} target="_blank" rel="noreferrer" variant="secondary" icon={<Icon name="play" size={16} />}>
            Open the meeting link
          </ButtonLink>
        </div>
      )}

      {!cancelled &&
        (roster.students.length ? (
          <>
            {roster.canMark && (
              <div className={styles.rosterBar}>
                <strong>{`${ticked.size} of ${roster.students.length} present`}</strong>
                <Button
                  variant="secondary"
                  icon={<Icon name="check" size={16} />}
                  onClick={() => setTicked(allTicked ? new Set() : new Set(roster.students.map((s) => s.orderId)))}
                >
                  {allTicked ? "Clear all" : "Mark all present"}
                </Button>
              </div>
            )}
            <ul className={styles.roster} aria-label="Students">
              {roster.students.map((s) => (
                <li key={s.orderId}>
                  <label className={styles.student}>
                    <input type="checkbox" checked={ticked.has(s.orderId)} disabled={!roster.canMark} onChange={(e) => toggle(s.orderId, e.target.checked)} />
                    <span className={styles.studentName}>
                      {s.name}
                      {(s.kind === "demo" || s.child) && <span className={vendor.faint}>{[s.kind === "demo" ? "Demo class" : null, s.child ? "Child" : null].filter(Boolean).join(" · ")}</span>}
                    </span>
                    {s.present !== null && (
                      <span className={styles.marked} data-present={s.present}>
                        {s.present ? "Present" : "Absent"}
                      </span>
                    )}
                  </label>
                </li>
              ))}
            </ul>
            {failure && (
              <p className={vendor.error} role="alert">
                {failure}
              </p>
            )}
            {roster.canMark && (
              <div className={vendor.actions}>
                <Button size="lg" loading={saving} disabled={!dirty} onClick={() => void save()}>
                  {dirty ? "Save attendance" : "Saved"}
                </Button>
              </div>
            )}
          </>
        ) : (
          <Empty title="No students yet">
            <p>Paid students and demo bookings for this class show up here.</p>
          </Empty>
        ))}

      {canChange &&
        (panel === "move" ? (
          <ClassTime
            title="Move this class"
            start={cls.startsAt}
            minutes={minutes}
            withReason
            confirmLabel="Move class"
            busy={busy}
            failure={panelFailure}
            onConfirm={move}
            onCancel={() => setPanel(null)}
          />
        ) : panel === "cancel" ? (
          <section className={vendor.card}>
            <h2 className={vendor.section}>Cancel this class?</h2>
            <p className={vendor.muted}>Every student and parent is told why. Demo students booked into it are refunded. There’s no refund for one class; add an extra class to make it up.</p>
            <TextArea label="Tell them why" value={reason} onChange={setReason} max={300} placeholder="e.g. Teacher unwell, we’ll add a class next week" />
            {panelFailure && (
              <p className={vendor.error} role="alert">
                {panelFailure}
              </p>
            )}
            <div className={vendor.actions}>
              <Button variant="danger" loading={busy} disabled={reason.trim().length < 5} onClick={cancel}>
                Cancel class
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => setPanel(null)}>
                Keep it
              </Button>
            </div>
          </section>
        ) : (
          <ul className={vendor.rows}>
            <li>
              <button type="button" className={`${vendor.row} ${styles.rowButton}`} onClick={() => setPanel("move")}>
                <Icon name="calendar" size={20} />
                <span className={vendor.rowText}>
                  <span className={vendor.rowTitle}>Move this class</span>
                  <span className={vendor.rowLine}>Everyone is told the new time</span>
                </span>
              </button>
            </li>
            <li>
              <button type="button" className={`${vendor.row} ${styles.rowButton}`} onClick={() => setPanel("cancel")}>
                <Icon name="close" size={20} />
                <span className={vendor.rowText}>
                  <span className={vendor.rowTitle}>Cancel this class</span>
                  <span className={vendor.rowLine}>No refund for one class; add an extra class to make it up</span>
                </span>
              </button>
            </li>
          </ul>
        ))}

      {batch && (
        <Link href={`/teach/batches/${batch.id}`} className={vendor.link}>
          Open the batch: every class, students, messages and files
        </Link>
      )}
    </div>
  );
}

/** One class: its students with a tick each and "Mark all present", saving attendance, and moving or cancelling it. Same as the app. */
export function ClassScreen({ id }: { id: string }) {
  const roster = useLoad(() => getRoster(id), id);
  const batchId = roster.data?.batch.id ?? "";
  const batch = useLoad(() => (batchId ? getDeskBatch(batchId) : Promise.resolve(null)), batchId);

  if (roster.data) return <ClassView key={`${roster.data.class.id}-${roster.data.class.startsAt}-${roster.data.class.status}`} roster={roster.data} batch={batch.data ?? null} onRoster={roster.setData} reloadBatch={batch.reload} />;
  if (roster.error) {
    if (roster.error instanceof ApiError && (roster.error.status === 404 || roster.error.status === 403)) {
      return (
        <Empty title="Class not found">
          <p>{formError(roster.error).message}</p>
          <ButtonLink href="/teach" variant="secondary">
            Classes
          </ButtonLink>
        </Empty>
      );
    }
    return <Failed error={roster.error} onRetry={roster.reload} />;
  }
  return <Loading rows={5} />;
}
