"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { Needs, useCan } from "@/components/admin/AdminFrame";
import { Failed, Fact, date, styles } from "@/components/admin/parts";
import { Avatar } from "@/components/profile/Avatar";
import { useMe, useOnSignedOut } from "@/components/social/session";
import menu from "@/components/social/PostCard.module.css";
import support from "@/components/support/support.module.css";
import { Button, ButtonLink, Card, Icon, Segmented, Skeleton, Tag, useToast, type IconName } from "@/components/ui";
import { formError } from "@/lib/api/account";
import { newIdempotencyKey } from "@/lib/api/client";
import { DELIVERY_STATUS_LABEL } from "@/lib/api/orders";
import {
  getStaffTicket,
  reopenKycCase,
  staffReply,
  supportAgents,
  updateTicket,
  type QueueStatus,
  type StaffMessage,
  type StaffTicketDetail,
  type SupportAgent,
  type SupportCategory,
  type SupportPriority,
  type TicketPatch,
} from "@/lib/api/support";
import { CATEGORIES, CATEGORY_LABEL, DESK_STATUS, PRIORITIES, PRIORITY, TEXT_MAX } from "@/lib/support";
import { exact, stamp } from "@/lib/time";
import ui from "./ticket.module.css";

const STATUSES: { value: QueueStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "waiting", label: "Waiting" },
  { value: "resolved", label: "Resolved" },
];

const MODES = [
  { value: "reply", label: "Reply" },
  { value: "note", label: "Note for the team" },
] as const;
type Mode = (typeof MODES)[number]["value"];

/** Messages shown before "View full conversation". */
const RECENT = 3;

const KYC_LABEL: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  submitted: "Waiting for review",
  approved: "Approved",
  rejected: "Sent back",
  locked: "On hold",
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

interface MenuItem {
  label: string;
  icon: IconName;
  href?: string;
  onSelect?: () => void;
}

/** Everything that isn't on the page itself: links out, assigning, notes and reopening verification. */
function MoreMenu({ items }: { items: MenuItem[] }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
      return;
    }
    if (event.key === "Tab") {
      setOpen(false);
      return;
    }
    const all = Array.from(list.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []);
    const at = all.indexOf(document.activeElement as HTMLElement);
    const next = ({ ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: all.length - 1 } as Record<string, number>)[event.key];
    if (next === undefined) return;
    event.preventDefault();
    all[(next + all.length) % all.length]?.focus();
  };

  return (
    <div className={menu.menuRoot} ref={root}>
      <button
        ref={trigger}
        type="button"
        className={menu.iconButton}
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="more" size={20} />
      </button>
      {open && (
        <div ref={list} id={id} className={menu.menu} role="menu" aria-label="More actions" onKeyDown={onKeyDown}>
          {items.map((item) =>
            item.href ? (
              <Link
                key={item.label}
                href={item.href}
                role="menuitem"
                tabIndex={-1}
                className={`${menu.menuItem} ${ui.menuLink}`}
                onClick={() => setOpen(false)}
              >
                <Icon name={item.icon} size={18} /> {item.label}
              </Link>
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={menu.menuItem}
                onClick={() => {
                  setOpen(false);
                  item.onSelect?.();
                }}
              >
                <Icon name={item.icon} size={18} /> {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

/** Priority, topic and who has it. Each change saves at once. */
function Manage({
  t,
  busy,
  save,
  onDone,
}: {
  t: StaffTicketDetail;
  busy: boolean;
  save: (patch: TicketPatch) => Promise<void>;
  onDone: () => void;
}) {
  const me = useMe();
  const ids = { priority: useId(), assignee: useId(), topic: useId() };
  const [agents, setAgents] = useState<SupportAgent[] | null>(null);

  useEffect(() => {
    let live = true;
    supportAgents().then(
      (list) => live && setAgents(list),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, []);

  const assigneeId = t.assignee?.id ?? "";
  const listed = agents?.some((a) => a.id === assigneeId);

  return (
    <>
      <div className={ui.editGrid}>
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
            autoFocus
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
      <div className={styles.actions}>
        <span className={styles.muted}>Changes save at once. A new priority moves the reply-by time.</span>
        <Button variant="secondary" onClick={onDone}>
          Done
        </Button>
      </div>
    </>
  );
}

/** A reply the customer sees, or a note only the team sees. */
function Composer({
  t,
  mode,
  onMode,
  field,
  onSent,
}: {
  t: StaffTicketDetail;
  mode: Mode;
  onMode: (mode: Mode) => void;
  field: RefObject<HTMLTextAreaElement | null>;
  onSent: (next: StaffTicketDetail) => void;
}) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const id = useId();
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
    <div className={`${styles.reason} ${ui.composer}`}>
      <Segmented label="Reply or note" options={MODES} value={mode} onChange={onMode} />
      <label className={styles.label} htmlFor={id}>
        {mode === "reply" ? `Reply to ${t.requester.name || "them"}` : "Note for the team"}
      </label>
      <textarea
        ref={field}
        id={id}
        className={styles.textarea}
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={TEXT_MAX}
        rows={4}
        placeholder={mode === "reply" ? "They are told at once." : "Only the Ruxstar team sees notes."}
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
function Reopen({ caseId, onCancel, onDone }: { caseId: string; onCancel: () => void; onDone: () => void }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
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
    }
  };

  return (
    <div className={styles.note}>
      <span className={styles.whoRow}>
        <strong>Reopen verification?</strong>
        <span className={styles.muted}>They get one more try to send their details, and are told in the app.</span>
      </span>
      <div className={styles.actions}>
        <Button variant="ghost" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button loading={busy} onClick={() => void reopen()} autoFocus>
          Reopen
        </Button>
      </div>
    </div>
  );
}

function Message({ m }: { m: StaffMessage }) {
  const mine = m.from === "staff";
  return (
    <li className={ui.message} data-mine={mine || undefined} data-internal={m.internal || undefined}>
      <span className={ui.byline}>
        {m.author.name || (mine ? "Ruxstar" : "Them")} ·{" "}
        <time dateTime={m.at} title={exact(m.at)}>
          {stamp(m.at)}
        </time>
      </span>
      <div className={ui.bubble}>
        {m.internal && (
          <span className={ui.noteTag}>
            <Icon name="lock" size={14} /> Note for the team
          </span>
        )}
        {m.text && <p className={ui.text}>{m.text}</p>}
        {m.photos.length > 0 && (
          <div className={support.photos}>
            {m.photos.map((p, i) => (
              <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className={support.photo} aria-label={`Open photo ${i + 1} of ${m.photos.length}`}>
                <img src={p.url} alt="" loading="lazy" />
              </a>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

function Ticket({ t, onChanged, onReload }: { t: StaffTicketDetail; onChanged: (next: StaffTicketDetail) => void; onReload: () => void }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const me = useMe();
  const canManage = useCan("support.manage");
  const canSeePeople = useCan("users.view");
  const canSeeBusinesses = useCan("businesses.view");
  const canReview = useCan("kyc.review");
  const canAudit = useCan("audit.view");
  const ids = { customer: useId(), info: useId(), edit: useId(), status: useId(), conversation: useId(), thread: useId() };
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [full, setFull] = useState(false);
  const [mode, setMode] = useState<Mode>("reply");
  const field = useRef<HTMLTextAreaElement>(null);

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

  const ctx = t.context;
  const ctxLabels: Record<string, string> | null = ctx?.type === "verification" ? KYC_LABEL : ctx?.type === "delivery" ? DELIVERY_STATUS_LABEL : null;
  const ctxState = ctx?.state ? (ctxLabels?.[ctx.state] ?? ctx.state) : null;
  const canReopen = ctx?.type === "verification" && ctx.state === "locked" && !!ctx.kycCaseId && canReview;
  const requester = t.requester;
  const status = t.status === "closed" ? "resolved" : t.status;

  const items: MenuItem[] = [];
  if (canManage && me && t.assignee?.id !== me.id) items.push({ label: "Assign to me", icon: "user", onSelect: () => void save({ assigneeId: me.id }) });
  if (canManage) {
    items.push({ label: "Change assignee, priority or topic", icon: "edit", onSelect: () => setEditing(true) });
    items.push({
      label: "Write a note for the team",
      icon: "lock",
      onSelect: () => {
        setMode("note");
        requestAnimationFrame(() => field.current?.focus());
      },
    });
  }
  if (ctx?.type === "business" && canSeeBusinesses) items.push({ label: "Open the business", icon: "store", href: `/admin/businesses/${ctx.id}` });
  if (canReopen) items.push({ label: "Reopen verification", icon: "shield", onSelect: () => setReopening(true) });
  if (canAudit) items.push({ label: "History for this ticket", icon: "clock", href: `/admin/audit?target=${t.id}` });

  const notes = t.messages.filter((m) => m.internal).length;
  const count = `${plural(t.messages.length - notes, "message", "messages")}${notes ? ` · ${plural(notes, "note", "notes")}` : ""}`;
  const hidden = full ? 0 : Math.max(0, t.messages.length - RECENT);

  const person = (
    <>
      <Avatar name={requester.name || requester.username || "?"} size={44} />
      <span className={styles.whoRow}>
        <span className={styles.name}>{requester.name || "No name"}</span>
        <span className={`${styles.muted} ${styles.line}`}>{requester.username ? `@${requester.username}` : "No username"}</span>
      </span>
      {requester.status !== "active" && <Tag tone="warning">{requester.status === "locked" ? "On hold" : "Deleted"}</Tag>}
    </>
  );

  return (
    <>
      <header className={ui.header}>
        <div className={ui.heading}>
          <h1 className={styles.title}>{t.subject}</h1>
          <p className={styles.muted}>{`${t.number} · Opened ${date(t.createdAt)}`}</p>
          <div className={styles.tags}>
            <Tag tone={DESK_STATUS[t.status].tone}>{DESK_STATUS[t.status].label}</Tag>
            {t.overdue && <Tag tone="danger">Overdue</Tag>}
            <Tag tone={PRIORITY[t.priority].tone}>{`${PRIORITY[t.priority].label} priority`}</Tag>
          </div>
        </div>
        <div className={ui.headActions}>
          {canManage && (
            <button
              type="button"
              className={menu.iconButton}
              aria-label="Change assignee, priority or topic"
              aria-expanded={editing}
              aria-controls={editing ? ids.edit : undefined}
              onClick={() => setEditing((e) => !e)}
            >
              <Icon name="edit" size={20} />
            </button>
          )}
          {items.length > 0 && <MoreMenu items={items} />}
        </div>
      </header>

      <div className={ui.layout}>
        <Card as="section" padding="lg" className={ui.card} aria-label="Ticket details">
          <section className={ui.section} aria-labelledby={ids.customer}>
            <h2 id={ids.customer} className={ui.sectionTitle}>
              Customer
            </h2>
            {canSeePeople && requester.status !== "deleted" ? (
              <Link href={`/admin/users/${requester.id}`} className={ui.person} title="Open their account">
                {person}
                <Icon name="chevron-right" size={20} className={styles.chevron} />
              </Link>
            ) : (
              <div className={ui.person}>{person}</div>
            )}
          </section>

          <section className={ui.section} aria-labelledby={ids.info}>
            <h2 id={ids.info} className={ui.sectionTitle}>
              Ticket information
            </h2>
            <dl className={ui.info}>
              <Fact label="Topic" value={CATEGORY_LABEL[t.category]} />
              <Fact label="Assigned to" value={t.assignee?.name ?? "Nobody"} warn={!t.assignee && t.status === "open"} />
              <Fact label="Last response" value={t.lastFrom === "staff" ? "Ruxstar" : requester.name || "Them"} />
              <Fact label="Priority" value={PRIORITY[t.priority].label} />
              {ctx && <Fact label="About" value={`${ctx.label}${ctxState ? ` (${ctxState})` : ""}`} />}
              {t.slaDueAt && <Fact label="Reply by" value={exact(t.slaDueAt)} warn={t.overdue} />}
            </dl>
          </section>

          {canManage && editing && (
            <section id={ids.edit} className={ui.section} aria-labelledby={`${ids.edit}-title`}>
              <h2 id={`${ids.edit}-title`} className={ui.sectionTitle}>
                Change details
              </h2>
              <Manage t={t} busy={busy} save={save} onDone={() => setEditing(false)} />
            </section>
          )}

          {canReopen && reopening && ctx?.kycCaseId && (
            <section className={ui.section} aria-label="Reopen verification">
              <Reopen
                caseId={ctx.kycCaseId}
                onCancel={() => setReopening(false)}
                onDone={() => {
                  setReopening(false);
                  onReload();
                }}
              />
            </section>
          )}

          <section className={ui.section} aria-labelledby={ids.status}>
            <h2 id={ids.status} className={ui.sectionTitle}>
              Ticket status
            </h2>
            {canManage ? (
              <Segmented
                label="Ticket status"
                options={STATUSES}
                value={status}
                onChange={(next) => {
                  if (next === status) return;
                  if (next === "resolved") setResolving(true);
                  else void save({ status: next });
                }}
              />
            ) : (
              <p className={styles.muted}>{DESK_STATUS[t.status].label}</p>
            )}
            {canManage && resolving && status !== "resolved" && (
              <div role="group" aria-label="Resolve this ticket?">
                <p>{`Resolve this ticket? ${requester.name || "They"} will be told it is resolved. They can reply to reopen it for 7 days.`}</p>
                <div className={styles.tags}>
                  <Button loading={busy} onClick={() => void save({ status: "resolved" }).then(() => setResolving(false))}>
                    Resolve
                  </Button>
                  <Button variant="ghost" onClick={() => setResolving(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            {t.status === "closed" && <p className={styles.muted}>Closed: the customer can no longer reply to reopen it.</p>}
          </section>
        </Card>

        <Card as="section" padding="lg" className={ui.card} aria-labelledby={ids.conversation}>
          <div className={ui.section}>
            <div className={ui.sectionHead}>
              <h2 id={ids.conversation} className={ui.sectionTitle}>
                Conversation
              </h2>
              <span className={styles.muted}>{count}</span>
            </div>
            {hidden > 0 && <p className={styles.muted}>{`Showing the latest ${RECENT} of ${t.messages.length}.`}</p>}
            {t.messages.length === 0 ? (
              <p className={styles.muted}>No messages yet.</p>
            ) : (
              <ol id={ids.thread} className={ui.thread}>
                {t.messages.slice(hidden).map((m) => (
                  <Message key={m.id} m={m} />
                ))}
              </ol>
            )}
            {t.messages.length > RECENT && (
              <button type="button" className={ui.toggle} aria-expanded={full} aria-controls={ids.thread} onClick={() => setFull((f) => !f)}>
                {full ? "Show latest only" : "View full conversation"}
              </button>
            )}
          </div>
          {canManage ? (
            <Composer t={t} mode={mode} onMode={setMode} field={field} onSent={onChanged} />
          ) : (
            <p className={`${styles.muted} ${ui.composer}`}>Answering tickets is not part of your access.</p>
          )}
        </Card>
      </div>
    </>
  );
}

/** One help ticket for the Ruxstar team: who sent it, what it is about, the conversation, and answering it. Same as the app. */
export function SupportTicketScreen({ id }: { id: string }) {
  const onSignedOut = useOnSignedOut();
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
          <Ticket t={t} onChanged={setTicket} onReload={() => setAttempt((n) => n + 1)} />
        )}
      </div>
    </Needs>
  );
}
