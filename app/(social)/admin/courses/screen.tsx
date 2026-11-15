"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Needs } from "@/components/admin/AdminFrame";
import { Failed, MoreFailed, Rows, styles } from "@/components/admin/parts";
import { Avatar } from "@/components/profile/Avatar";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { Icon, Input, Segmented, Skeleton, Tag } from "@/components/ui";
import { staffCourses, type StaffCourseStatus, type VendorCourse } from "@/lib/api/coaching";
import { CATEGORY_LABEL, COURSE_STATUS, placeLine } from "@/lib/coaching";

type Status = StaffCourseStatus | "all";
type Filter = { status?: StaffCourseStatus; q?: string };

const STATUSES: { value: Status; label: string }[] = [
  { value: "all", label: "All" },
  { value: "live", label: "Live" },
  { value: "draft", label: "Drafts" },
  { value: "removed", label: "Taken down" },
];

function Results({ filter }: { filter: Filter }) {
  const onSignedOut = useOnSignedOut();
  const load = useCallback((cursor?: string) => staffCourses(filter, cursor), [filter]);
  const { items, loading, loadingMore, hasMore, error, moreFailed, more, reload } = usePages<VendorCourse>(load);
  const sentinel = useNearEnd(more, hasMore && !error);

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  if (loading) return <Rows count={5} />;
  if (error && items.length === 0) return <Failed error={error} onRetry={reload} />;
  if (items.length === 0) {
    return <p className={styles.empty}>{filter.q ? "No course matches that. Try another word from the course or the institute’s name." : "Courses institutes make show up here."}</p>;
  }

  return (
    <ul className={styles.list}>
      {items.map((c) => {
        const status = COURSE_STATUS[c.status];
        return (
          <li key={c.id} className={styles.item}>
            <Link href={`/admin/courses/${c.id}`} className={styles.row}>
              <Avatar name={c.title} url={c.photo?.url ?? null} size={44} />
              <span className={styles.whoRow}>
                <span className={styles.name}>{c.title}</span>
                <span className={`${styles.muted} ${styles.line}`}>
                  {`${c.business.name} · ${CATEGORY_LABEL[c.category]} · ${placeLine(c)} · ${c.status === "draft" ? "Not published" : `${c.counts.students} students`}`}
                </span>
              </span>
              <span className={styles.tags}>
                <Tag tone={status.tone}>{status.label}</Tag>
              </span>
              <Icon name="chevron-right" size={20} className={styles.chevron} />
            </Link>
          </li>
        );
      })}
      {hasMore && <li ref={sentinel} aria-hidden />}
      {moreFailed && <MoreFailed onRetry={more} />}
      {loadingMore && <Skeleton height={72} radius={14} />}
    </ul>
  );
}

/** Every institute's courses, newest first, searchable by name and filtered by status. Same as the app. */
export function CoursesScreen() {
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status>("all");

  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);

  const filter: Filter = { ...(q ? { q } : {}), ...(status === "all" ? {} : { status }) };

  return (
    <Needs need="businesses.view">
      <div className={styles.page}>
        <h1 className={styles.title}>Courses</h1>
        <div className={styles.toolbar}>
          <Input
            label="Find a course"
            placeholder="Course or institute name"
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={60}
            autoComplete="off"
          />
          <Segmented label="Status" options={STATUSES} value={status} onChange={setStatus} />
        </div>
        <Results key={`${status}:${q}`} filter={filter} />
      </div>
    </Needs>
  );
}
