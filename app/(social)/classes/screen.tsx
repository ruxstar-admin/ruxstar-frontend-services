"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Button, ButtonLink, Icon, Segmented, Skeleton, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { ClassRow } from "@/components/coaching/ClassRow";
import { useLoad } from "@/components/vendor/use-load";
import { formError } from "@/lib/api/account";
import { myCertificates, myEnrolments, timetable, type Certificate, type CoachingOrder, type MyClassesView, type TimetableRow } from "@/lib/api/coaching";
import { addDays, attendanceLine, KIND_LABEL, mondayOf, ORDER_STATUS } from "@/lib/coaching";
import { dayLabel, dayText, istParts, istToday } from "@/lib/events";
import social from "@/components/social/social.module.css";
import shop from "@/components/shop/shop.module.css";
import order from "@/components/shop/order.module.css";
import styles from "@/components/coaching/coaching.module.css";

type Tab = "week" | "enrolments" | "certificates";
const TABS: { value: Tab; label: string }[] = [
  { value: "week", label: "This week" },
  { value: "enrolments", label: "Enrolled" },
  { value: "certificates", label: "Certificates" },
];
const VIEWS = [
  { value: "current", label: "Current" },
  { value: "past", label: "Past" },
] as const;
/** Certificate links work for 10 minutes; older ones are fetched again before opening. */
const LINK_MS = 9 * 60_000;

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

/** One week of classes, yours and your children's, day by day. Cancelled and moved classes stay so you see what changed. */
function Week() {
  const today = istToday();
  const [monday, setMonday] = useState(() => mondayOf(today));
  const [now, setNow] = useState(Date.now);
  const { data, error, reload } = useLoad(() => timetable(monday, 7), monday);

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

  const days = new Map<string, TimetableRow[]>();
  for (const row of data ?? []) {
    const day = istParts(row.class.startsAt).day;
    days.set(day, [...(days.get(day) ?? []), row]);
  }
  const thisWeek = monday === mondayOf(today);

  return (
    <>
      <div className={styles.weekNav}>
        <Button variant="ghost" icon={<Icon name="arrow-left" size={16} />} onClick={() => setMonday(addDays(monday, -7))} aria-label="Week before">
          Before
        </Button>
        <strong aria-live="polite">{thisWeek ? "This week" : `${dayLabel(monday)} – ${dayLabel(addDays(monday, 6))}`}</strong>
        <Button variant="ghost" onClick={() => setMonday(addDays(monday, 7))} aria-label="Week after">
          After
          <Icon name="arrow-right" size={16} />
        </Button>
      </div>
      {error && !data ? (
        <Failure error={error} onRetry={reload} />
      ) : !data ? (
        <Busy />
      ) : days.size === 0 ? (
        <Empty title={thisWeek ? "No classes this week" : "No classes that week"}>
          <p>Classes for you and your children show up here, with a join button for online ones.</p>
        </Empty>
      ) : (
        [...days.entries()].map(([day, rows]) => (
          <section key={day} className={styles.day}>
            <h2 className={styles.dayTitle} data-today={day === today || undefined}>
              {day === today ? `Today · ${dayLabel(day)}` : dayLabel(day)}
            </h2>
            {rows.map((r) => (
              <ClassRow
                key={`${r.orderId}-${r.class.id}`}
                cls={r.class}
                title={r.course.title}
                href={`/classes/${r.orderId}`}
                line={[r.batchName, r.student.childId ? r.student.name : null, r.business].filter(Boolean).join(" · ")}
                demo={r.kind === "demo"}
                now={now}
              />
            ))}
          </section>
        ))
      )}
    </>
  );
}

function EnrolmentRow({ item }: { item: CoachingOrder }) {
  const status = ORDER_STATUS[item.status];
  const cancelled = item.status === "cancelled" || item.batch.cancelled;
  return (
    <Link href={`/classes/${item.id}`} className={order.row}>
      <span className={order.rowIcon}>
        <Icon name={item.kind === "demo" ? "play" : "book"} size={20} />
      </span>
      <span className={order.rowText}>
        <span className={order.rowTitle}>{item.course.title}</span>
        <span className={order.small}>{`${item.student.name} · ${item.kind === "demo" ? `Demo, ${dayText(item.batch.firstAt)}` : item.batch.schedule}`}</span>
        <span className={order.faint}>{item.kind === "batch" && item.status === "confirmed" ? attendanceLine(item.attendance) : `${KIND_LABEL[item.kind]} · ${item.business.name}`}</span>
      </span>
      {item.certificate && <Tag tone="success">Certificate</Tag>}
      {(item.status !== "confirmed" || cancelled) && <Tag tone={item.batch.cancelled ? "danger" : status.tone}>{item.batch.cancelled ? "Batch cancelled" : status.label}</Tag>}
      <Icon name="chevron-right" size={18} />
    </Link>
  );
}

function Enrolments({ view }: { view: MyClassesView }) {
  const onSignedOut = useOnSignedOut();
  const { items, loading, loadingMore, hasMore, error, more, reload } = usePages((cursor) => myEnrolments(view, cursor));
  const sentinel = useNearEnd(more, hasMore && !error);

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  if (loading) return <Busy />;
  if (error && items.length === 0) return <Failure error={error} onRetry={reload} />;
  if (items.length === 0) {
    return view === "current" ? (
      <Empty title="No classes yet">
        <p>Enrol yourself or your children in a batch, or try a demo class first.</p>
        <ButtonLink href="/discover?category=coaching" variant="secondary">
          Find courses
        </ButtonLink>
      </Empty>
    ) : (
      <Empty title="Nothing past yet">
        <p>Batches that have ended, and cancelled enrolments, show up here.</p>
      </Empty>
    );
  }
  return (
    <>
      <ul className={order.rows}>
        {items.map((item) => (
          <li key={item.id}>
            <EnrolmentRow item={item} />
          </li>
        ))}
      </ul>
      {hasMore && <div ref={sentinel} className={social.sentinel} aria-hidden />}
      {loadingMore && <Skeleton height={84} radius={16} />}
    </>
  );
}

function Certificates() {
  const { data, error, reload, setData } = useLoad(() => myCertificates(), "certificates");
  const loadedAt = useRef(Date.now());

  useEffect(() => {
    if (data) loadedAt.current = Date.now();
  }, [data]);

  /** A link older than its 10 minutes is fetched fresh first. */
  const open = async (e: MouseEvent<HTMLAnchorElement>, cert: Certificate) => {
    if (Date.now() - loadedAt.current < LINK_MS) return;
    e.preventDefault();
    try {
      const fresh = await myCertificates();
      setData(fresh);
      const url = fresh.find((c) => c.id === cert.id)?.pdfUrl;
      if (url) window.location.assign(url);
    } catch {
      reload();
    }
  };

  if (error && !data) return <Failure error={error} onRetry={reload} />;
  if (!data) return <Busy />;
  if (!data.length) {
    return (
      <Empty title="No certificates yet">
        <p>When a batch ends, students who attended enough classes get a certificate here.</p>
      </Empty>
    );
  }
  return (
    <ul className={order.rows}>
      {data.map((c) => (
        <li key={c.id}>
          <a href={c.pdfUrl} target="_blank" rel="noreferrer" className={order.row} onClick={(e) => void open(e, c)}>
            <span className={order.rowIcon}>
              <Icon name="verified" size={20} />
            </span>
            <span className={order.rowText}>
              <span className={order.rowTitle}>{`${c.studentName} · ${c.courseTitle}`}</span>
              <span className={order.small}>{`${c.batchName} · ${c.businessName}`}</span>
              <span className={order.faint}>{`Came to ${c.attended} of ${c.classes} classes · issued ${dayText(c.issuedAt)} · code ${c.code}`}</span>
            </span>
            <span className={order.rowEnd}>PDF</span>
            <Icon name="download" size={18} />
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Your and your children's classes: this week's timetable, every enrolment, and certificates. Same as the app. */
export function MyClassesScreen() {
  const [tab, setTab] = useState<Tab>("week");
  const [view, setView] = useState<MyClassesView>("current");
  return (
    <div className={order.page}>
      <div className={shop.headRow}>
        <h1 className={order.title}>Your classes</h1>
        <div className={shop.headActions}>
          <ButtonLink href="/classes/children" variant="secondary" icon={<Icon name="users" size={16} />}>
            Children
          </ButtonLink>
          <ButtonLink href="/discover?category=coaching" variant="secondary" icon={<Icon name="search" size={16} />}>
            Find courses
          </ButtonLink>
        </div>
      </div>
      <Segmented label="Show" options={TABS} value={tab} onChange={setTab} />
      {tab === "week" && <Week />}
      {tab === "enrolments" && (
        <>
          <Segmented label="Which enrolments" options={VIEWS} value={view} onChange={setView} />
          <Enrolments key={view} view={view} />
        </>
      )}
      {tab === "certificates" && <Certificates />}
    </div>
  );
}
