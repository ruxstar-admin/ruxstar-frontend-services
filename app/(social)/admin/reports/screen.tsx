"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Needs, useCan } from "@/components/admin/AdminFrame";
import { Failed, Fact, ReasonForm, Rows, date, styles } from "@/components/admin/parts";
import { Avatar } from "@/components/profile/Avatar";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { Button, Icon, Segmented, Skeleton, Tag, useToast } from "@/components/ui";
import { formError } from "@/lib/api/account";
import { dismissPerson, keepPost, personQueue, removePost, reportQueue, type PersonCase, type ReportCase, type ReportStatus } from "@/lib/api/admin";
import { ago, exact } from "@/lib/time";
import { OrderProblemsQueue } from "./orders";

const TABS: { value: ReportStatus; label: string }[] = [
  { value: "open", label: "To review" },
  { value: "closed", label: "Closed" },
];

const REASON_LABEL: Record<keyof ReportCase["reasons"], string> = {
  spam: "Spam",
  fake: "Fake or scam",
  abuse: "Abuse",
  undelivered: "Not delivered",
  other: "Other",
};

const reasonTags = (c: ReportCase) =>
  (Object.keys(REASON_LABEL) as (keyof ReportCase["reasons"])[]).filter((k) => c.reasons[k] > 0).map((k) => `${REASON_LABEL[k]} ${c.reasons[k]}`);

function Detail({ c, onDone }: { c: ReportCase; onDone: (c: ReportCase, verb: string) => void }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const canAct = useCan("reports.act");
  const canSeePeople = useCan("users.view");
  const [removing, setRemoving] = useState(false);
  const [busy, setBusy] = useState<"keep" | "remove" | null>(null);
  const keys = useRef({ keep: crypto.randomUUID(), remove: crypto.randomUUID() });
  const post = c.post;

  async function act(kind: "keep" | "remove", reason = "") {
    setBusy(kind);
    try {
      const done = kind === "keep" ? await keepPost(c.postId, keys.current.keep) : await removePost(c.postId, reason, keys.current.remove);
      onDone(done, kind === "keep" ? "kept" : "removed");
    } catch (err) {
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={styles.detail}>
      <dl className={styles.facts}>
        <Fact label="Reports" value={String(c.reports)} />
        <Fact label="First reported" value={date(c.firstAt)} />
        <Fact label="Last reported" value={date(c.lastAt)} />
        {post && <Fact label="Posted" value={date(post.createdAt)} />}
        {post?.author && (
          <Fact
            label="Posted by"
            value={canSeePeople ? <Link href={`/admin/users/${post.author.id}`}>@{post.author.username}</Link> : `@${post.author.username}`}
            warn={post.author.status !== "active"}
          />
        )}
      </dl>

      {post ? (
        <>
          {post.text && <p className={styles.text}>{post.text}</p>}
          {post.media.length > 0 && (
            <div className={styles.thumbs}>
              {post.media.map((m) => (
                <img key={m.url} src={m.url} alt="" loading="lazy" width={96} height={96} />
              ))}
            </div>
          )}
          {post.status === "removed" && post.removal && (
            <p className={styles.note} data-tone="danger">
              Removed {ago(post.removal.at)}: {post.removal.reason}
            </p>
          )}
          {post.status === "deleted" && <p className={styles.note}>The author deleted this post.</p>}
        </>
      ) : (
        <p className={styles.note}>This post no longer exists.</p>
      )}

      {c.status === "open" &&
        canAct &&
        (removing ? (
          <ReasonForm
            prompt="Why is it coming down? The author will see this."
            placeholder="For example: this listing sells counterfeit goods."
            confirm="Remove post"
            busy={busy === "remove"}
            onCancel={() => setRemoving(false)}
            onSubmit={(reason) => act("remove", reason)}
          />
        ) : (
          <div className={styles.actions}>
            {post?.status === "live" && (
              <Link href={`/p/${post.id}`} className={styles.muted} target="_blank">
                Open the post
              </Link>
            )}
            <Button variant="secondary" onClick={() => act("keep")} loading={busy === "keep"} disabled={!!busy}>
              Keep it up
            </Button>
            {post?.status === "live" && (
              <Button variant="danger" onClick={() => setRemoving(true)} disabled={!!busy} icon={<Icon name="trash" size={18} />}>
                Remove
              </Button>
            )}
          </div>
        ))}
    </div>
  );
}

function Queue({ status }: { status: ReportStatus }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback((cursor?: string) => reportQueue(status, cursor), [status]);
  const { items, setItems, loading, loadingMore, hasMore, error, more, reload } = usePages(load);
  const sentinel = useNearEnd(more, hasMore && !error);

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  if (loading) return <Rows />;
  if (error && items.length === 0) return <Failed error={error} onRetry={reload} />;
  if (items.length === 0) return <p className={styles.empty}>{status === "open" ? "No reported posts. Nice." : "Nothing closed yet."}</p>;

  return (
    <ul className={styles.list}>
      {items.map((c) => {
        const expanded = open === c.postId;
        const author = c.post?.author;
        const when = status === "open" ? c.lastAt : (c.closedAt ?? c.lastAt);
        return (
          <li key={c.postId} className={styles.item} data-open={expanded || undefined}>
            <button type="button" className={styles.row} aria-expanded={expanded} onClick={() => setOpen(expanded ? null : c.postId)}>
              <Avatar name={author?.name ?? "?"} url={author?.avatarUrl} size={44} />
              <span className={styles.whoRow}>
                <span className={styles.name}>{c.post?.text.trim() || (c.post?.media.length ? "Photo post" : "Post")}</span>
                <span className={`${styles.muted} ${styles.line}`}>
                  {author ? `@${author.username} · ` : ""}
                  {reasonTags(c).join(", ") || `${c.reports} reports`}
                </span>
              </span>
              {c.outcome ? (
                <Tag tone={c.outcome === "removed" ? "danger" : "success"}>{c.outcome === "removed" ? "Removed" : "Kept"}</Tag>
              ) : (
                <Tag tone="warning">{c.reports === 1 ? "1 report" : `${c.reports} reports`}</Tag>
              )}
              <time className={styles.time} dateTime={when} title={exact(when)}>
                {ago(when)}
              </time>
              <Icon name="chevron-down" size={20} className={styles.chevron} />
            </button>
            {expanded && (
              <Detail
                c={c}
                onDone={(done, verb) => {
                  toast(`Post ${verb}.`, "success");
                  setOpen(null);
                  setItems((list) => list.filter((x) => x.postId !== done.postId));
                }}
              />
            )}
          </li>
        );
      })}
      {hasMore && <li ref={sentinel} aria-hidden />}
      {loadingMore && <Skeleton height={72} radius={14} />}
    </ul>
  );
}

const PERSON_REASON: Record<keyof PersonCase["reasons"], string> = {
  spam: "Spam",
  fake: "Fake account",
  abuse: "Abuse",
  scam: "Scam",
  other: "Other",
};

const personTags = (c: PersonCase) =>
  (Object.keys(PERSON_REASON) as (keyof PersonCase["reasons"])[]).filter((k) => c.reasons[k] > 0).map((k) => `${PERSON_REASON[k]} ${c.reasons[k]}`);

function PersonDetail({ c, onDone }: { c: PersonCase; onDone: (c: PersonCase) => void }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const canAct = useCan("reports.act");
  const canSeePeople = useCan("users.view");
  const [busy, setBusy] = useState(false);
  const key = useRef(crypto.randomUUID());

  async function dismiss() {
    setBusy(true);
    try {
      onDone(await dismissPerson(c.userId, key.current));
    } catch (err) {
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.detail}>
      <dl className={styles.facts}>
        <Fact label="Reports" value={String(c.reports)} />
        <Fact label="First reported" value={date(c.firstAt)} />
        <Fact label="Last reported" value={date(c.lastAt)} />
        {c.user && (
          <Fact
            label="Account"
            value={canSeePeople ? <Link href={`/admin/users/${c.userId}`}>@{c.user.username}</Link> : `@${c.user.username}`}
            warn={c.user.status !== "active"}
          />
        )}
      </dl>
      {c.notes.map((note, i) => (
        <p key={i} className={styles.text}>
          “{note}”
        </p>
      ))}
      {c.status === "open" && <p className={styles.note}>Putting their account on hold from People closes these reports.</p>}
      {c.status === "open" && canAct && (
        <div className={styles.actions}>
          {c.user && (
            <Link href={`/u/${c.user.username}`} className={styles.muted} target="_blank">
              Open their profile
            </Link>
          )}
          <Button variant="secondary" onClick={dismiss} loading={busy}>
            Dismiss reports
          </Button>
        </div>
      )}
    </div>
  );
}

function PeopleQueue({ status }: { status: ReportStatus }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback((cursor?: string) => personQueue(status, cursor), [status]);
  const { items, setItems, loading, loadingMore, hasMore, error, more, reload } = usePages(load);
  const sentinel = useNearEnd(more, hasMore && !error);

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  if (loading) return <Rows />;
  if (error && items.length === 0) return <Failed error={error} onRetry={reload} />;
  if (items.length === 0) return <p className={styles.empty}>{status === "open" ? "No reported people." : "Nothing closed yet."}</p>;

  return (
    <ul className={styles.list}>
      {items.map((c) => {
        const expanded = open === c.userId;
        const when = status === "open" ? c.lastAt : (c.closedAt ?? c.lastAt);
        return (
          <li key={c.userId} className={styles.item} data-open={expanded || undefined}>
            <button type="button" className={styles.row} aria-expanded={expanded} onClick={() => setOpen(expanded ? null : c.userId)}>
              <Avatar name={c.user?.name ?? "?"} url={c.user?.avatarUrl} size={44} />
              <span className={styles.whoRow}>
                <span className={styles.name}>{c.user?.name || "Deleted account"}</span>
                <span className={`${styles.muted} ${styles.line}`}>
                  {c.user ? `@${c.user.username} · ` : ""}
                  {personTags(c).join(", ") || `${c.reports} reports`}
                </span>
              </span>
              {c.outcome ? (
                <Tag tone={c.outcome === "held" ? "danger" : "success"}>{c.outcome === "held" ? "On hold" : "Dismissed"}</Tag>
              ) : (
                <Tag tone="warning">{c.reports === 1 ? "1 report" : `${c.reports} reports`}</Tag>
              )}
              <time className={styles.time} dateTime={when} title={exact(when)}>
                {ago(when)}
              </time>
              <Icon name="chevron-down" size={20} className={styles.chevron} />
            </button>
            {expanded && (
              <PersonDetail
                c={c}
                onDone={(done) => {
                  toast("Reports dismissed.", "success");
                  setOpen(null);
                  setItems((list) => list.filter((x) => x.userId !== done.userId));
                }}
              />
            )}
          </li>
        );
      })}
      {hasMore && <li ref={sentinel} aria-hidden />}
      {loadingMore && <Skeleton height={72} radius={14} />}
    </ul>
  );
}

type Subject = "posts" | "people" | "orders";

const SUBJECTS: { value: Subject; label: string }[] = [
  { value: "posts", label: "Posts" },
  { value: "people", label: "People" },
  { value: "orders", label: "Orders" },
];

function Reports() {
  const canReports = useCan("reports.view");
  const canOrders = useCan("orders.view");
  const subjects = SUBJECTS.filter((s) => (s.value === "orders" ? canOrders : canReports));
  const [subject, setSubject] = useState<Subject>(canReports ? "posts" : "orders");
  const [status, setStatus] = useState<ReportStatus>("open");
  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <h1 className={styles.title}>Reports</h1>
        {subjects.length > 1 && <Segmented label="Reported" options={subjects} value={subject} onChange={setSubject} />}
        <Segmented label="Show" options={TABS} value={status} onChange={setStatus} />
      </div>
      {subject === "posts" ? (
        <Queue key={`posts-${status}`} status={status} />
      ) : subject === "people" ? (
        <PeopleQueue key={`people-${status}`} status={status} />
      ) : (
        <OrderProblemsQueue key={`orders-${status}`} status={status === "open" ? "open" : "resolved"} />
      )}
    </div>
  );
}

export function ReportsScreen() {
  return (
    <Needs need={["reports.view", "orders.view"]}>
      <Reports />
    </Needs>
  );
}
