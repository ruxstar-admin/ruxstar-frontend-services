"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Icon, Segmented, Skeleton, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useLoad } from "@/components/vendor/use-load";
import { formError } from "@/lib/api/account";
import { deskBatches, todaysClasses, type DeskBatch, type TodayClass } from "@/lib/api/coaching";
import { BATCH_STATUS, markLine } from "@/lib/coaching";
import { dayText, timeText } from "@/lib/events";
import social from "@/components/social/social.module.css";
import order from "@/components/shop/order.module.css";
import styles from "@/components/coaching/coaching.module.css";

type Tab = "today" | "batches";
const TABS: { value: Tab; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "batches", label: "Batches" },
];

const students = (n: number) => `${n} ${n === 1 ? "student" : "students"}`;

function Failure({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className={social.failed} role="alert">
      <p>{formError(error).message}</p>
      <Button variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

const Busy = () => (
  <div className={order.rows} aria-busy>
    <Skeleton height={84} radius={16} />
    <Skeleton height={84} radius={16} />
  </div>
);

function useRefresh(reload: () => void) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const onShow = () => {
      if (document.visibilityState !== "visible") return;
      setNow(Date.now());
      reload();
    };
    document.addEventListener("visibilitychange", onShow);
    const tick = setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      document.removeEventListener("visibilitychange", onShow);
      clearInterval(tick);
    };
  }, [reload]);
  return now;
}

function TodayRow({ cls, now }: { cls: TodayClass; now: number }) {
  const cancelled = cls.status === "cancelled";
  const live = !cancelled && Date.parse(cls.startsAt) <= now && Date.parse(cls.endsAt) > now;
  const mark = markLine(cls, now);
  return (
    <Link href={`/teach/classes/${cls.id}`} className={styles.lesson} data-cancelled={cancelled || undefined}>
      <span className={styles.time}>
        {timeText(cls.startsAt)}
        <span>{`to ${timeText(cls.endsAt)}`}</span>
      </span>
      <span className={styles.lessonText}>
        <span className={styles.lessonTitle}>{cls.course.title}</span>
        <span className={order.small}>{`${cls.batch.name} · ${students(cls.students)}${cls.demos ? ` · ${cls.demos} demo` : ""}`}</span>
        <span className={styles.tags}>
          <Tag tone={mark.tone}>{mark.text}</Tag>
          {live && <Tag tone="success">Now</Tag>}
          {cls.extra && <Tag>Extra</Tag>}
        </span>
      </span>
      <Icon name="chevron-right" size={18} />
    </Link>
  );
}

function Today() {
  const { data, error, reload } = useLoad(() => todaysClasses(), "today");
  const now = useRefresh(reload);
  if (error && !data) return <Failure error={error} onRetry={reload} />;
  if (!data) return <Busy />;
  if (!data.length) {
    return (
      <Empty title="No classes today">
        <p>Classes from your batches show up here on the day, ready for attendance.</p>
      </Empty>
    );
  }
  return (
    <div className={order.rows}>
      {data.map((c) => (
        <TodayRow key={c.id} cls={c} now={now} />
      ))}
    </div>
  );
}

function BatchRow({ batch }: { batch: DeskBatch }) {
  const status = BATCH_STATUS[batch.status];
  const next = batch.nextClass;
  return (
    <Link href={`/teach/batches/${batch.id}`} className={order.row}>
      <span className={order.rowIcon}>
        <Icon name="book" size={20} />
      </span>
      <span className={order.rowText}>
        <span className={order.rowTitle}>{batch.course.title}</span>
        <span className={order.small}>{`${batch.name} · ${batch.business.name}`}</span>
        <span className={order.small}>{batch.schedule}</span>
        <span className={order.faint}>{`${students(batch.students)}${next ? ` · next ${dayText(next.startsAt)}, ${timeText(next.startsAt)}` : ""}`}</span>
      </span>
      {batch.role === "coach" && <Tag>Coach</Tag>}
      {batch.status !== "open" && batch.status !== "started" && <Tag tone={status.tone}>{status.label}</Tag>}
      <Icon name="chevron-right" size={18} />
    </Link>
  );
}

function Batches() {
  const { data, error, reload } = useLoad(() => deskBatches(), "batches");
  useRefresh(reload);
  if (error && !data) return <Failure error={error} onRetry={reload} />;
  if (!data) return <Busy />;
  if (!data.length) {
    return (
      <Empty title="No batches yet">
        <p>Batches you run, or the owner makes you a coach on, show up here.</p>
      </Empty>
    );
  }
  return (
    <ul className={order.rows}>
      {data.map((b) => (
        <li key={b.id}>
          <BatchRow batch={b} />
        </li>
      ))}
    </ul>
  );
}

/** Classes for the owner and coaches: today's, ready for attendance, and every batch they teach. Same as the app. */
export function TeachScreen() {
  const [tab, setTab] = useState<Tab>("today");
  return (
    <div className={order.page}>
      <h1 className={order.title}>Classes</h1>
      <Segmented label="Show" options={TABS} value={tab} onChange={setTab} />
      {tab === "today" ? <Today /> : <Batches />}
    </div>
  );
}
