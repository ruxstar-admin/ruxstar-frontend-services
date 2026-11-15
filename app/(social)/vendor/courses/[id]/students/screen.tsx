"use client";

import { useEffect, useState } from "react";
import { Icon, Segmented, Skeleton, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { Back, Failed, Loading } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { courseStudents, getVendorCourse, type StudentRow, type StudentsFilter } from "@/lib/api/coaching";
import { money } from "@/lib/api/shops";
import { attendanceLine } from "@/lib/coaching";
import { dayText, timeText } from "@/lib/events";
import social from "@/components/social/social.module.css";
import vendor from "@/components/vendor/vendor.module.css";

type Tab = "enrolled" | "demos" | "cancelled";
const TABS: { value: Tab; label: string }[] = [
  { value: "enrolled", label: "Enrolled" },
  { value: "demos", label: "Demo requests" },
  { value: "cancelled", label: "Cancelled" },
];
const FILTERS: Record<Tab, StudentsFilter> = {
  enrolled: { kind: "batch", status: "confirmed" },
  demos: { kind: "demo", status: "confirmed" },
  cancelled: { status: "cancelled" },
};

function Student({ row }: { row: StudentRow }) {
  const cancelled = row.status === "cancelled";
  const detail =
    row.kind === "demo"
      ? row.demoAt
        ? `Demo ${dayText(row.demoAt)}, ${timeText(row.demoAt)}`
        : "Demo class"
      : cancelled
        ? row.batch.name
        : `${row.batch.name} · ${attendanceLine(row.attendance)}`;
  const paid = row.total ? `${money(row.total)} paid · your share ${money(row.share)}` : "Free";
  return (
    <li className={vendor.row}>
      <Icon name={row.kind === "demo" ? "play" : "user"} size={20} />
      <span className={vendor.rowText}>
        <span className={vendor.rowTitle}>{row.student.child ? `${row.student.name} (child of ${row.parent.name})` : row.student.name}</span>
        <span className={vendor.rowLine}>{detail}</span>
        <span className={vendor.rowLine}>{`#${row.orderNo} · ${row.refunded ? `${money(row.refunded)} refunded` : paid}`}</span>
        {row.parent.phone && (
          <a href={`tel:${row.parent.phone}`} className={vendor.link}>
            {`Call ${row.parent.phone}`}
          </a>
        )}
      </span>
      {cancelled && <Tag>{row.kind === "demo" ? "Demo cancelled" : "Cancelled"}</Tag>}
    </li>
  );
}

function List({ courseId, filter }: { courseId: string; filter: StudentsFilter }) {
  const onSignedOut = useOnSignedOut();
  const { items, loading, loadingMore, hasMore, error, more, reload } = usePages((cursor) => courseStudents(courseId, filter, cursor));
  const sentinel = useNearEnd(more, hasMore && !error);

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  if (loading) return <Skeleton height={84} radius={16} />;
  if (error && !items.length) return <Failed error={error} onRetry={reload} />;
  if (!items.length) {
    return (
      <Empty title={filter.kind === "demo" ? "No demo requests" : filter.status === "cancelled" ? "Nobody has cancelled" : "No students yet"}>
        <p>{filter.kind === "demo" ? "People who book a demo class show up here with their number, so you can follow up." : "They show up here as soon as they pay."}</p>
      </Empty>
    );
  }
  return (
    <>
      <ul className={vendor.rows}>
        {items.map((r) => (
          <Student key={r.id} row={r} />
        ))}
      </ul>
      {hasMore && <div ref={sentinel} className={social.sentinel} aria-hidden />}
      {loadingMore && <Skeleton height={84} radius={16} />}
    </>
  );
}

/** Who enrolled in a course, who booked a demo, and who cancelled, with parents’ numbers. Filter by batch. */
export function CourseStudentsScreen({ id }: { id: string }) {
  const { data, error, reload } = useLoad(() => getVendorCourse(id), id);
  const [tab, setTab] = useState<Tab>("enrolled");
  const [batchId, setBatchId] = useState<string | undefined>(undefined);

  if (error && !data) return <Failed error={error} onRetry={reload} />;
  if (!data) return <Loading rows={4} />;
  const filter = { ...FILTERS[tab], batchId };

  return (
    <div className={vendor.page}>
      <Back href={`/vendor/courses/${id}`}>{data.title}</Back>
      <h1 className={vendor.title}>Students</h1>
      <span className={vendor.muted}>{`${data.counts.students} enrolled · ${data.counts.demos} demo classes booked`}</span>
      <Segmented label="Show" options={TABS} value={tab} onChange={setTab} />
      {data.batches.length > 1 && (
        <div className={vendor.chips} role="group" aria-label="Batch">
          <button type="button" className={vendor.chip} aria-pressed={!batchId} onClick={() => setBatchId(undefined)}>
            All batches
          </button>
          {data.batches.map((b) => (
            <button key={b.id} type="button" className={vendor.chip} aria-pressed={batchId === b.id} onClick={() => setBatchId(b.id)}>
              {b.name}
            </button>
          ))}
        </div>
      )}
      <List key={`${tab}-${batchId ?? "all"}`} courseId={id} filter={filter} />
    </div>
  );
}
