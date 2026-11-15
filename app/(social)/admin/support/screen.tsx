"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Needs } from "@/components/admin/AdminFrame";
import { Failed, MoreFailed, Rows, styles } from "@/components/admin/parts";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { ButtonLink, Icon, Skeleton, Tag } from "@/components/ui";
import { supportQueue, supportSummary, type QueueFilter, type QueueStatus, type StaffTicket, type SupportCategory } from "@/lib/api/support";
import { CATEGORIES, CATEGORY_LABEL, isCategory, PRIORITY } from "@/lib/support";
import { ago, exact } from "@/lib/time";

const STATUSES: { value: QueueStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "waiting", label: "Waiting on them" },
  { value: "resolved", label: "Resolved" },
];

type Who = "" | "me" | "none";
const WHO: { value: Who; label: string }[] = [
  { value: "", label: "Anyone" },
  { value: "me", label: "Me" },
  { value: "none", label: "Nobody" },
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
  const { items, loading, loadingMore, hasMore, error, moreFailed, more, reload } = usePages<StaffTicket>(load);
  const sentinel = useNearEnd(more, hasMore && !error);

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  if (loading) return <Rows count={5} />;
  if (error && items.length === 0) return <Failed error={error} onRetry={reload} />;
  if (items.length === 0) {
    return (
      <p className={styles.empty}>
        {filter.q
          ? "No ticket with that number."
          : filter.category || filter.assignee
            ? "No tickets for these filters."
            : filter.status === "open"
              ? "Nothing waiting for Ruxstar."
              : "Nothing here."}
      </p>
    );
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
      {moreFailed && <MoreFailed onRetry={more} />}
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
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const ids = { q: useId(), status: useId(), topic: useId(), who: useId() };
  const statusParam = params.get("status");
  const status: QueueStatus = STATUSES.some((s) => s.value === statusParam) ? (statusParam as QueueStatus) : "open";
  const topicParam = params.get("category");
  const topic: SupportCategory | "" = isCategory(topicParam) ? topicParam : "";
  const whoParam = params.get("assignee");
  const who: Who = whoParam === "me" || whoParam === "none" ? whoParam : "";
  const q = (params.get("q") ?? "").trim();
  const [text, setText] = useState(q);

  const setParams = useCallback(
    (changes: Record<string, string>) => {
      const next = new URLSearchParams(params);
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const sent = useRef(q);

  useEffect(() => {
    if (q === sent.current) return;
    sent.current = q;
    setText(q);
  }, [q]);

  useEffect(() => {
    const next = text.trim();
    if (next === q) return;
    const t = setTimeout(() => {
      sent.current = next;
      setParams({ q: next });
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(t);
  }, [text, q, setParams]);

  const filter: QueueFilter = { status, ...(q ? { q } : {}), ...(who ? { assignee: who } : {}), ...(topic ? { category: topic } : {}) };
  const filtered = !!(q || who || topic || status !== "open");

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
        <div className={styles.filters} role="group" aria-label="Filters">
          <div className={styles.filter}>
            <label className={styles.filterLabel} htmlFor={ids.q}>
              Find a ticket
            </label>
            <input
              id={ids.q}
              type="search"
              className={`${styles.filterControl} ${styles.filterSearch}`}
              data-set={q ? true : undefined}
              placeholder="Number, like RX-1042"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={20}
              autoComplete="off"
            />
          </div>
          <div className={styles.filter}>
            <label className={styles.filterLabel} htmlFor={ids.status}>
              Status
            </label>
            <select
              id={ids.status}
              className={styles.filterControl}
              data-set={status !== "open" ? true : undefined}
              value={status}
              onChange={(e) => setParams({ status: e.target.value === "open" ? "" : e.target.value })}
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.filter}>
            <label className={styles.filterLabel} htmlFor={ids.topic}>
              Topic
            </label>
            <select id={ids.topic} className={styles.filterControl} data-set={topic ? true : undefined} value={topic} onChange={(e) => setParams({ category: e.target.value })}>
              <option value="">Any topic</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.filter}>
            <label className={styles.filterLabel} htmlFor={ids.who}>
              Assigned
            </label>
            <select id={ids.who} className={styles.filterControl} data-set={who ? true : undefined} value={who} onChange={(e) => setParams({ assignee: e.target.value })}>
              {WHO.map((w) => (
                <option key={w.value} value={w.value}>
                  {w.label}
                </option>
              ))}
            </select>
          </div>
          {filtered && (
            <button
              type="button"
              className={styles.clear}
              onClick={() => {
                setText("");
                router.replace(pathname, { scroll: false });
              }}
            >
              Clear
            </button>
          )}
        </div>
        <Results key={`${q}|${status}|${who}|${topic}`} filter={filter} />
      </div>
    </Needs>
  );
}
