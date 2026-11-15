import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonLink, Icon, Tag } from "@/components/ui";
import type { ClassView } from "@/lib/api/coaching";
import { lengthText } from "@/lib/coaching";
import { dayText, timeText } from "@/lib/events";
import order from "@/components/shop/order.module.css";
import styles from "./coaching.module.css";

/** Cancelled, moved, extra and attendance, as small tags. */
export function ClassTags({ cls, demo }: { cls: ClassView; demo?: boolean }) {
  const tags: ReactNode[] = [];
  if (demo) tags.push(<Tag key="demo">Demo</Tag>);
  if (cls.status === "cancelled") tags.push(<Tag key="cancelled" tone="danger">Cancelled</Tag>);
  if (cls.movedFrom && cls.status !== "cancelled") tags.push(<Tag key="moved" tone="warning">Moved</Tag>);
  if (cls.extra) tags.push(<Tag key="extra">Extra class</Tag>);
  if (cls.attendance === "present") tags.push(<Tag key="present" tone="success">Present</Tag>);
  if (cls.attendance === "absent") tags.push(<Tag key="absent">Absent</Tag>);
  return tags.length ? <span className={styles.tags}>{tags}</span> : null;
}

/** What changed about a class, in words: why it was cancelled, or when it was meant to be. */
export function changeLine(cls: ClassView): string | null {
  if (cls.status === "cancelled") return cls.cancelReason ? `Cancelled: ${cls.cancelReason}` : "Cancelled";
  if (cls.movedFrom) return `Moved from ${dayText(cls.movedFrom)}, ${timeText(cls.movedFrom)}`;
  return null;
}

/** The join button from shortly before an online class until it ends, or when the link opens. */
export function JoinLine({ cls, now }: { cls: ClassView; now: number }) {
  if (cls.status !== "upcoming") return null;
  if (cls.joinLink) {
    return (
      <span>
        <ButtonLink href={cls.joinLink} target="_blank" rel="noreferrer" icon={<Icon name="play" size={16} />}>
          Join class
        </ButtonLink>
      </span>
    );
  }
  if (cls.joinFrom && Date.parse(cls.joinFrom) > now) return <span className={order.faint}>{`The link shows here at ${timeText(cls.joinFrom)}.`}</span>;
  return null;
}

/** One class: its time on the left, then what it is, what changed, and joining. */
export function ClassRow({
  cls,
  title,
  href,
  line,
  demo,
  now,
}: {
  cls: ClassView;
  title: string;
  href?: string;
  line?: string;
  demo?: boolean;
  now: number;
}) {
  const change = changeLine(cls);
  const minutes = Math.round((Date.parse(cls.endsAt) - Date.parse(cls.startsAt)) / 60_000);
  return (
    <div className={styles.lesson} data-cancelled={cls.status === "cancelled" || undefined}>
      <span className={styles.time}>
        {timeText(cls.startsAt)}
        <span>{lengthText(minutes)}</span>
      </span>
      <span className={styles.lessonText}>
        {href ? (
          <Link href={href} className={styles.lessonTitle}>
            {title}
          </Link>
        ) : (
          <span className={styles.lessonTitle}>{title}</span>
        )}
        {line && <span className={order.small}>{line}</span>}
        {change && <span className={order.faint}>{change}</span>}
        <ClassTags cls={cls} demo={demo} />
        <JoinLine cls={cls} now={now} />
      </span>
    </div>
  );
}
