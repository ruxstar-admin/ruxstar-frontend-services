"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Needs, useCan } from "@/components/admin/AdminFrame";
import { Failed, Fact, date, styles } from "@/components/admin/parts";
import { useMe, useOnSignedOut } from "@/components/social/session";
import { MessageBubble } from "@/components/support/Parts";
import support from "@/components/support/support.module.css";
import { Button, ButtonLink, Card, Icon, Segmented, Skeleton, Tag, useToast } from "@/components/ui";
import { formError } from "@/lib/api/account";
import { newIdempotencyKey } from "@/lib/api/client";
import {
  getStaffTicket,
  reopenKycCase,
  staffReply,
  supportAgents,
  updateTicket,
  type QueueStatus,
  type StaffTicketDetail,
  type SupportAgent,
  type SupportCategory,
  type SupportPriority,
  type TicketPatch,
} from "@/lib/api/support";
import { CATEGORIES, CATEGORY_LABEL, DESK_STATUS, PRIORITIES, PRIORITY, TEXT_MAX } from "@/lib/support";
import { exact } from "@/lib/time";

const STATUSES: { value: QueueStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "waiting", label: "Waiting" },
  { value: "resolved", label: "Resolved" },
];

const MODES = [
  { value: "reply", label: "Reply" },
  { value: "note", label: "Note for the team" },
] as const;

const KYC_LABEL: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  submitted: "Waiting for review",
  approved: "Approved",
  rejected: "Sent back",
  locked: "On hold",
};

/** Status, priority, topic and who has it. Each change saves at once. */
function Manage({ t, onChanged }: { t: StaffTicketDetail; onChanged: (next: StaffTicketDetail) => void }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const me = useMe();
  const ids = { priority: useId(), assignee: useId(), topic: useId() };
  const [agents, setAgents] = useState<SupportAgent[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    supportAgents().then(
      (list) => live && setAgents(list),
      () => live && setAgents([]),
    );
    return () => {
      live = false;
    };
  }, []);

  const save = async (patch: TicketPatch) => {
    if (busy) return;
    setBusy(true);
    try {
      onChanged(await updateTicket(t.id, patch));
    } catch (err) {
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setBusy(false);
    }
  };

  const assigneeId = t.assignee?.id ?? "";
  const listed = agents?.some((a) => a.id === assigneeId);

  return (
    <div className={styles.facts}>
      <div className={styles.reason}>
        <span className={styles.label}>Status</span>
        <Segmented
          label="Status"
          options={STATUSES}
          value={t.status === "closed" ? "resolved" : t.status}
          onChange={(status) => status !== t.status && void save({ status })}
        />
      </div>
      <div className={styles.reason}>
        <label className={styles.label} htmlFor={ids.priority}>
          Priority
        </label>
        <select
          id={ids.priority}
          className={styles.select}
          value={t.priority}
          disabled={busy}
          onChange={(e) => void save({ priority: e.target.value as SupportPriority })}
        >
          {PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.reason}>
        <label className={styles.label} htmlFor={ids.assignee}>
          Assigned to
        </label>
        <select
          id={ids.assignee}
          className={styles.select}
          value={assigneeId}
          disabled={busy || !agents}
          onChange={(e) => void save({ assigneeId: e.target.value || null })}
        >
          <option value="">Nobody</option>
          {t.assignee && !listed && <option value={t.assignee.id}>{t.assignee.name}</option>}
          {(agents ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {`${a.name} (${a.title})`}
            </option>
          ))}
        </select>
        {me && assigneeId !== me.id && (
          <div>
            <Button variant="ghost" disabled={busy} onClick={() => void save({ assigneeId: me.id })}>
              Assign to me
            </Button>
          </div>
        )}
      </div>
      <div className={styles.reason}>
        <label className={styles.label} htmlFor={ids.topic}>
          Topic
        </label>
        <select
          id={ids.topic}
          className={styles.select}
          value={t.category}
          disabled={busy}
          onChange={(e) => void save({ category: e.target.value as SupportCategory })}
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

/** A reply the customer sees, or a note only the team sees. */
function Composer({ t, onSent }: { t: StaffTicketDetail; onSent: (next: StaffTicketDetail) => void }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const id = useId();
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"send" | "resolve" | null>(null);
  const key = useRef(newIdempotencyKey());

  const send = async (resolve: boolean) => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(resolve ? "resolve" : "send");
    try {
      const next = await staffReply(t.id, { text: body, internal: mode === "note", ...(resolve ? { status: "resolved" as const } : {}) }, key.current);
      key.current = newIdempotencyKey();
      setText("");
      onSent(next);
      toast(mode === "note" ? "Note added." : resolve ? "Sent and resolved." : "Reply sent. They have been told.", "success");
    } catch (err) {
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={styles.reason}>
      <Segmented label="Reply or note" options={MODES} value={mode} onChange={setMode} />
      <label className={styles.label} htmlFor={id}>
        {mode === "reply" ? "Reply" : "Note"}
      </label>
      <textarea
        id={id}
        className={styles.textarea}
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={TEXT_MAX}
        rows={4}
        placeholder={mode === "reply" ? `Write to ${t.requester.name || "them"}. They are told at once.` : "Only the Ruxstar team sees notes."}
      />
      <div className={styles.actions}>
        <span className={styles.count}>{`${text.length}/${TEXT_MAX}`}</span>
        {mode === "reply" ? (
          <>
            <Button variant="secondary" loading={busy === "resolve"} disabled={!text.trim() || !!busy} onClick={() => void send(true)}>
              Send and resolve
            </Button>
            <Button loading={busy === "send"} disabled={!text.trim() || !!busy} onClick={() => void send(false)}>
              Send reply
            </Button>
          </>
        ) : (
          <Button loading={busy === "send"} disabled={!text.trim() || !!busy} onClick={() => void send(false)}>
            Add note
          </Button>
        )}
      </div>
    </div>
  );
}

/** A verification case on hold after too many rejections, from the ticket about it. */
function Reopen({ caseId, onDone }: { caseId: string; onDone: () => void }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const key = useRef(newIdempotencyKey());

  const reopen = async () => {
    setBusy(true);
    try {
      await reopenKycCase(caseId, key.current);
      key.current = newIdempotencyKey();
      toast("Verification reopened. They have one more try and have been told.", "success");
      onDone();
    } catch (err) {
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  if (!confirming) {
    return (
      <div>
        <Button variant="secondary" icon={<Icon name="shield" size={18} />} onClick={() => setConfirming(true)}>
          Reopen verification
        </Button>
      </div>
    );
  }
  return (
    <div className={styles.note}>
      <span className={styles.whoRow}>
        <strong>Reopen verification?</strong>
        <span className={styles.muted}>They get one more try to send their details, and are told in the app.</span>
      </span>
      <div className={styles.actions}>
        <Button variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
          Cancel
        </Button>
        <Button loading={busy} onClick={() => void reopen()}>
          Reopen
        </Button>
      </div>
    </div>
  );
}

/** One help ticket for the Ruxstar team: who sent it, what it is about, the conversation, and answering it. Same as the app. */
export function SupportTicketScreen({ id }: { id: string }) {
  const onSignedOut = useOnSignedOut();
  const canManage = useCan("support.manage");
  const canSeePeople = useCan("users.view");
  const canSeeBusinesses = useCan("businesses.view");
  const canReview = useCan("kyc.review");
  const canAudit = useCan("audit.view");
  const [t, setTicket] = useState<StaffTicketDetail | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    getStaffTicket(id).then(
      (next) => live && setTicket(next),
      (err) => live && !onSignedOut(err) && setError(err),
    );
    return () => {
      live = false;
    };
  }, [id, attempt, onSignedOut]);

  const ctx = t?.context ?? null;
  const ctxState = ctx?.state ? (ctx.type === "verification" ? (KYC_LABEL[ctx.state] ?? ctx.state) : ctx.state) : null;
  const from = t
    ? `${t.requester.name || "No name"}${t.requester.username ? ` (@${t.requester.username})` : ""}${t.requester.status === "locked" ? ", on hold" : t.requester.status === "deleted" ? ", deleted" : ""}`
    : "";

  return (
    <Needs need="support.view">
      <div className={styles.page}>
        <div>
          <ButtonLink href="/admin/support" variant="ghost" icon={<Icon name="arrow-left" size={18} />}>
            Help tickets
          </ButtonLink>
        </div>

        {error ? (
          <Failed
            error={error}
            onRetry={() => {
              setError(null);
              setAttempt((n) => n + 1);
            }}
          />
        ) : !t ? (
          <Skeleton height={420} radius={16} />
        ) : (
          <Card as="section" padding="lg" className={styles.page}>
            <div className={styles.head}>
              <div>
                <h1 className={styles.title}>{t.subject}</h1>
                <p className={styles.muted}>{`${t.number} · opened ${date(t.createdAt)}`}</p>
              </div>
              <div className={styles.tags}>
                <Tag tone={DESK_STATUS[t.status].tone}>{DESK_STATUS[t.status].label}</Tag>
                {t.overdue ? <Tag tone="danger">Overdue</Tag> : <Tag tone={PRIORITY[t.priority].tone}>{PRIORITY[t.priority].label}</Tag>}
              </div>
            </div>

            <dl className={styles.facts}>
              <Fact label="From" value={from} warn={t.requester.status !== "active"} />
              <Fact label="Topic" value={CATEGORY_LABEL[t.category]} />
              <Fact label="About" value={ctx ? `${ctx.label}${ctxState ? ` (${ctxState})` : ""}` : "Nothing linked"} />
              <Fact label="Assigned to" value={t.assignee?.name ?? "Nobody"} warn={!t.assignee && t.status === "open"} />
              <Fact label="Reply by" value={t.slaDueAt ? exact(t.slaDueAt) : "—"} warn={t.overdue} />
              <Fact label="Last from" value={t.lastFrom === "staff" ? "Ruxstar" : "Them"} />
            </dl>

            {ctx?.type === "verification" && ctx.state === "locked" && ctx.kycCaseId && canReview && (
              <Reopen caseId={ctx.kycCaseId} onDone={() => setAttempt((n) => n + 1)} />
            )}

            <div className={styles.tags}>
              {canSeePeople && t.requester.status !== "deleted" && (
                <ButtonLink href={`/admin/users/${t.requester.id}`} variant="ghost" icon={<Icon name="user" size={18} />}>
                  Open their account
                </ButtonLink>
              )}
              {ctx?.type === "business" && canSeeBusinesses && (
                <ButtonLink href={`/admin/businesses/${ctx.id}`} variant="ghost" icon={<Icon name="store" size={18} />}>
                  Open the business
                </ButtonLink>
              )}
              {canAudit && (
                <ButtonLink href={`/admin/audit?target=${t.id}`} variant="ghost" icon={<Icon name="clock" size={18} />}>
                  History for this ticket
                </ButtonLink>
              )}
            </div>

            {canManage && <Manage t={t} onChanged={setTicket} />}

            <h2 className={styles.subtitle}>Conversation</h2>
            <ol className={support.thread}>
              {t.messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  text={m.text}
                  photos={m.photos}
                  at={m.at}
                  mine={m.from === "staff"}
                  byline={m.internal ? `${m.author.name} · note for the team` : m.author.name}
                  internal={m.internal}
                />
              ))}
            </ol>

            {canManage ? <Composer t={t} onSent={setTicket} /> : <p className={styles.muted}>Answering tickets is not part of your access.</p>}
          </Card>
        )}
      </div>
    </Needs>
  );
}
