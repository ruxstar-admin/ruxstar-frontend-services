import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui";
import type { CourseCard as Card, Photo } from "@/lib/api/coaching";
import { coverGradient, initialOf } from "@/lib/api/shops";
import { CATEGORY_LABEL, demoLine, feeLine, placeLine } from "@/lib/coaching";
import shop from "@/components/shop/shop.module.css";
import events from "@/components/events/events.module.css";
import styles from "./coaching.module.css";

/** The course photo at 16:9, or the title's initial on its own colours when there is none. */
export function CoursePhoto({
  photo,
  title,
  eager,
  dimmed,
  className = shop.cover,
  children,
}: {
  photo: Photo;
  title: string;
  eager?: boolean;
  dimmed?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={className} data-closed={dimmed || undefined} style={photo ? undefined : { background: coverGradient(title) }}>
      {photo ? (
        <img src={photo.url} width={photo.width} height={photo.height} alt={`Photo for ${title}`} loading={eager ? "eager" : "lazy"} decoding="async" />
      ) : (
        <span className={shop.initial} aria-hidden>
          {initialOf(title)}
        </span>
      )}
      {children}
    </div>
  );
}

/** A course on Discover: the photo, then the title, institute, where, and the fee. Same as the app. */
export function CourseCard({ course, eager, index }: { course: Card; eager?: boolean; index: number }) {
  const demo = demoLine(course);
  return (
    <Link href={`/courses/${course.id}`} className={shop.card} style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}>
      <CoursePhoto photo={course.photo} title={course.title} eager={eager} dimmed={course.openBatches === 0}>
        {demo && (
          <span className={events.overlay}>
            <span />
            <span className={styles.demoTag}>{demo}</span>
          </span>
        )}
      </CoursePhoto>
      <div className={shop.cardBody}>
        <span className={events.cardTitle}>{course.title}</span>
        <span className={shop.meta}>{`${CATEGORY_LABEL[course.category]} · ${course.business.name}`}</span>
        <span className={events.cardFacts}>
          <span>
            <Icon name={course.mode === "online" ? "play" : "map-pin"} size={14} />
            {placeLine(course)}
          </span>
          <span className={events.cardPrice} data-free={course.feeFrom === 0 || undefined}>
            {feeLine(course)}
          </span>
        </span>
      </div>
    </Link>
  );
}
