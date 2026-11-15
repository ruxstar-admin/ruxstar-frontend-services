"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ButtonLink, Icon, Skeleton, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { Back, Failed, Loading } from "@/components/vendor/parts";
import { useOnSignedOut } from "@/components/social/session";
import { businessCourses, type VendorCourse } from "@/lib/api/coaching";
import { CATEGORY_LABEL, COURSE_STATUS, MODE_LABEL } from "@/lib/coaching";
import social from "@/components/social/social.module.css";
import styles from "@/components/vendor/vendor.module.css";

function CourseRow({ course }: { course: VendorCourse }) {
  const status = COURSE_STATUS[course.status];
  const running = course.batches.filter((b) => b.status !== "cancelled" && b.status !== "ended").length;
  return (
    <Link href={`/vendor/courses/${course.id}`} className={styles.row}>
      <Icon name="book" size={20} />
      <span className={styles.rowText}>
        <span className={styles.rowTitle}>{course.title}</span>
        <span className={styles.rowLine}>{`${CATEGORY_LABEL[course.category]} · ${MODE_LABEL[course.mode]}`}</span>
        <span className={styles.rowLine}>
          {course.status === "draft"
            ? course.missing.length
              ? `To do: ${course.missing[0]}`
              : "Ready to publish"
            : `${running} ${running === 1 ? "batch" : "batches"} running · ${course.counts.students} ${course.counts.students === 1 ? "student" : "students"}`}
        </span>
      </span>
      <Tag tone={status.tone}>{status.label}</Tag>
      <Icon name="chevron-right" size={18} />
    </Link>
  );
}

/** A coaching business's courses, newest first, and the way to make a new one. */
export function BusinessCoursesScreen({ id }: { id: string }) {
  const onSignedOut = useOnSignedOut();
  const { items, loading, loadingMore, hasMore, error, more, reload } = usePages(() => businessCourses(id));
  const sentinel = useNearEnd(more, hasMore && !error);
  const create = `/vendor/businesses/${id}/courses/new`;

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  if (loading) return <Loading rows={3} />;
  if (error && !items.length) return <Failed error={error} onRetry={reload} />;

  return (
    <div className={styles.page}>
      <Back href={`/vendor/businesses/${id}`}>Business</Back>
      <div className={styles.head}>
        <h1 className={styles.title}>Courses</h1>
        {items.length > 0 && (
          <ButtonLink href={create} icon={<Icon name="plus" size={18} />}>
            New course
          </ButtonLink>
        )}
      </div>
      {items.length ? (
        <>
          <ul className={styles.rows}>
            {items.map((c) => (
              <li key={c.id}>
                <CourseRow course={c} />
              </li>
            ))}
          </ul>
          {hasMore && <div ref={sentinel} className={social.sentinel} aria-hidden />}
          {loadingMore && <Skeleton height={72} radius={16} />}
        </>
      ) : (
        <Empty title="No courses yet">
          <p>Make your first one, then add batches with their weekly timetable. It’s saved as a draft until you publish it.</p>
          <ButtonLink href={create} icon={<Icon name="plus" size={18} />}>
            New course
          </ButtonLink>
        </Empty>
      )}
    </div>
  );
}
