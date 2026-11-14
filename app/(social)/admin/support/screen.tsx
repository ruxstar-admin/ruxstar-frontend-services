"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Needs } from "@/components/admin/AdminFrame";
import { Failed, Rows, styles } from "@/components/admin/parts";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { ButtonLink, Icon, Input, Segmented, Skeleton, Tag } from "@/components/ui";
import { supportQueue, supportSummary, type QueueFilter, type QueueStatus, type StaffTicket, type SupportCategory } from "@/lib/api/support";
import { CATEGORIES, CATEGORY_LABEL, PRIORITY } from "@/lib/support";
import { ago, exact } from "@/lib/time";

const STATUSES: { value: QueueStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "waiting", label: "Waiting on them" },
  { value: "resolved", label: "Resolved" },
];

type Who = "all" | "me" | "none";
const WHO: { value: Who; label: string }[] = [
  { value: "all", label: "Everyone" },
  { value: "me", label: "Mine" },
  { value: "none", label: "Nobody on it" },
];

/** Waits this long after the last keystroke before searching. */
const SEARCH_DELAY_MS = 350;

/** Past its reply-by time first, then how urgent it is; nothing for normal and low. */
function Flag({ t }: { t: StaffTicket }) {
  if (t.overdue) return <Tag tone="danger">Overdue</Tag>;
  if (t.status === "open" && (t.priority === "urgent" || t.priority === "high")) return <Tag tone={PRIORITY[t.priority].tone}>{PRIORITY[t.priority].label}</Tag>;
  return null;
}

function Results({ filter }: { filter: QueueFilter }) {
  const onSignedOut = useOnSignedOut();
  const load = useCallback((cursor?: string) => supportQueue(filter, cursor), [filter]);
  const { items, loading, loadingMore, hasMore, error, more, reload } = usePages<StaffTicket>(load);
  const sentinel = useNearEnd(more, hasMore && !error);

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  if (loading) return <Rows count={5} />;
  if (error && items.length === 0) return <Failed error={error} onRetry={reload} />;
  if (items.length === 0) {
    return <p className={styles.empty}>{filter.q ? "No ticket with that number." : filter.status === "open" ? "Nothing waiting for Ruxstar." : "Nothing here."}</p>;
  }

  return (
    <ul className={styles.list}>
      {items.map((t) => (
        <li key={t.id} className={styles.item}>
          <Link href={`/admin/support/${t.id}`} className={styles.row}>
            <span className={styles.whoRow}>
              <span className={styles.name}>{t.subject}</span>
              <span className={`${styles.muted} ${styles.line}`}>
                {`${t.requester.name || `@${t.requester.username}`} · ${t.number} · ${CATEGORY_LABEL[t.category]} · ${t.assignee?.name ?? "Nobody"}`}
              </span>
            </span>
            <span className={styles.tags}>
              <Flag t={t} />
            </span>
            <time className={styles.time} dateTime={t.lastAt} title={exact(t.lastAt)}>
              {ago(t.lastAt)}
            </time>
            <Icon name="chevron-right" size={20} className={styles.chevron} />
          </Link>
        </li>
      ))}
      {hasMore && <li ref={sentinel} aria-hidden />}
      {loadingMore && <Skeleton height={72} radius={14} />}
    </ul>
  );
}

/** How many are open, overdue, with nobody on them, and yours. */
function Counts() {
  const [s, setSummary] = useState<Awaited<ReturnType<typeof supportSummary>> | null>(null);
  useEffect(() => {
    let live = true;
    supportSummary().then(
      (next) => live && setSummary(next),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, []);
  if (!s) return null;
  return (
    <div className={styles.tags}>
      <Tag tone="solid">{`${s.open} open`}</Tag>
      {s.overdue > 0 && <Tag tone="danger">{`${s.overdue} overdue`}</Tag>}
      {s.unassigned > 0 && <Tag tone="warning">{`${s.unassigned} with nobody on them`}</Tag>}
      {s.mine > 0 && <Tag>{`${s.mine} yours`}</Tag>}
    </div>
  );
}

/** Help tickets for the Ruxstar team, latest activity first, filtered by state, topic and who has them. Same as the app. */
export function SupportQueueScreen() {
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<QueueStatus>("open");
  const [who, setWho] = useState<Who>("all");
  const [topic, setTopic] = useState<SupportCategory | "">("");

  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(t);
  }, [text]);

  const filter: QueueFilter = { status, ...(q ? { q } : {}), ...(who === "all" ? {} : { assignee: who }), ...(topic ? { category: topic } : {}) };

  return (
    <Needs need="support.view">
      <div className={styles.page}>
        <div className={styles.head}>
          <h1 className={styles.title}>Help tickets</h1>
          <ButtonLink href="/admin/support/settings" variant="ghost" icon={<Icon name="clock" size={18} />}>
            Reply-by times
          </ButtonLink>
        </div>
        <Counts />
        <div className={styles.toolbar}>
          <Input
            label="Find a ticket"
            placeholder="Ticket number, like RX-1042"
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={20}
            autoComplete="off"
          />
          <select className={styles.select} aria-label="Who has it" value={who} onChange={(e) => setWho(e.target.value as Who)}>
            {WHO.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>
          <select className={styles.select} aria-label="Topic" value={topic} onChange={(e) => setTopic(e.target.value as SupportCategory | "")}>
            <option value="">Every topic</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <Segmented label="State" options={STATUSES} value={status} onChange={setStatus} />
        </div>
        <Results key={`${q}|${status}|${who}|${topic}`} filter={filter} />
      </div>
    </Needs>
  );
}
