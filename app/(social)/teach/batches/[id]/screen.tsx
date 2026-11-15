"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, ButtonLink, Icon, Input, Segmented, Skeleton, Switch, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { ClassTime, type ClassTimeValue } from "@/components/coaching/ClassTime";
import { Back, Failed, Loading, TextArea } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { formError } from "@/lib/api/account";
import { ApiError, newIdempotencyKey } from "@/lib/api/client";
import {
  addExtraClass,
  batchMaterials,
  batchMessages,
  batchStudents,
  getDeskBatch,
  messageBatch,
  removeMaterial,
  shareLink,
  uploadMaterial,
  type DeskBatchDetail,
  type DeskClass,
} from "@/lib/api/coaching";
import { BATCH_STATUS, markLine, sizeText } from "@/lib/coaching";
import { dayText, whenLine } from "@/lib/events";
import { ago } from "@/lib/time";
import vendor from "@/components/vendor/vendor.module.css";
import order from "@/components/shop/order.module.css";
import events from "@/components/events/events.module.css";
import styles from "@/components/coaching/coaching.module.css";

type Tab = "classes" | "students" | "messages" | "files";
const TABS: { value: Tab; label: string }[] = [
  { value: "classes", label: "Classes" },
  { value: "students", label: "Students" },
  { value: "messages", label: "Messages" },
  { value: "files", label: "Notes and files" },
];
/** Classes shown before "Show all". */
const FIRST_CLASSES = 8;
/** The API takes PDF, JPEG or PNG files up to 20 MB. */
const MAX_FILE = 20 * 1024 * 1024;
const FILE_TYPES = ["application/pdf", "image/jpeg", "image/png"];

const retryable = (err: unknown) => err instanceof ApiError && err.code === "NETWORK";

function ClassRows({ batch, now }: { batch: DeskBatchDetail; now: number }) {
  const [all, setAll] = useState(false);
  const firstUpcoming = batch.classes.findIndex((c) => Date.parse(c.endsAt) > now);
  const start = all ? 0 : Math.max(0, firstUpcoming === -1 ? batch.classes.length - FIRST_CLASSES : firstUpcoming - 1);
  const shown = all ? batch.classes : batch.classes.slice(start, start + FIRST_CLASSES);
  return (
    <>
      {shown.map((c: DeskClass) => {
        const mark = markLine(c, now);
        return (
          <Link key={c.id} href={`/teach/classes/${c.id}`} className={styles.lesson} data-cancelled={c.status === "cancelled" || undefined}>
            <span className={styles.time}>
              {`Class ${batch.classes.indexOf(c) + 1}`}
              <span>{c.demos ? `${c.demos} demo` : ""}</span>
            </span>
            <span className={styles.lessonText}>
              <span className={styles.lessonTitle}>{whenLine(c.startsAt, c.endsAt)}</span>
              <span className={styles.tags}>
                <Tag tone={mark.tone}>{mark.text}</Tag>
                {c.extra && <Tag>Extra</Tag>}
                {c.movedFrom && c.status !== "cancelled" && <Tag tone="warning">Moved</Tag>}
              </span>
            </span>
            <Icon name="chevron-right" size={18} />
          </Link>
        );
      })}
      {batch.classes.length > FIRST_CLASSES && (
        <button type="button" className={events.textLink} onClick={() => setAll(!all)}>
          {all ? "Show fewer" : `Show all ${batch.classes.length} classes`}
        </button>
      )}
    </>
  );
}

function Students({ batchId }: { batchId: string }) {
  const { data, error, reload } = useLoad(() => batchStudents(batchId), `s${batchId}`);
  if (error && !data) return <Failed error={error} onRetry={reload} />;
  if (!data) return <Skeleton height={84} radius={16} />;
  if (!data.length) {
    return (
      <Empty title="No students yet">
        <p>Students show up here once they’ve paid.</p>
      </Empty>
    );
  }
  return (
    <ul className={vendor.rows}>
      {data.map((s) => (
        <li key={s.orderId} className={vendor.row}>
          <Icon name="user" size={20} />
          <span className={vendor.rowText}>
            <span className={vendor.rowTitle}>{s.child ? `${s.name} (child)` : s.name}</span>
            <span className={vendor.rowLine}>{s.held ? `Came to ${s.attended} of ${s.held} · ${s.percent}%` : "No classes yet"}</span>
          </span>
          {s.held > 0 && <Tag tone={s.percent >= s.certificateAt ? "success" : "warning"}>{s.percent >= s.certificateAt ? "On track" : `Needs ${s.certificateAt}%`}</Tag>}
        </li>
      ))}
    </ul>
  );
}

function Messages({ batch }: { batch: DeskBatchDetail }) {
  const { data, error, reload, setData } = useLoad(() => batchMessages(batch.id), `m${batch.id}`);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const key = useRef(newIdempotencyKey());

  const send = async () => {
    setBusy(true);
    setFailure(null);
    try {
      const sent = await messageBatch(batch.id, text.trim(), key.current);
      key.current = newIdempotencyKey();
      setText("");
      setData([sent, ...(data ?? [])]);
    } catch (err) {
      setFailure(formError(err).message);
      if (!retryable(err)) key.current = newIdempotencyKey();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {batch.can.message && (
        <section className={vendor.card}>
          <TextArea label="Message the batch" value={text} onChange={setText} max={1000} placeholder="Like “Bring your geometry box on Friday”" />
          <p className={vendor.faint}>Every student and parent in the batch gets a notification.</p>
          {failure && (
            <p className={vendor.error} role="alert">
              {failure}
            </p>
          )}
          <div className={vendor.actions}>
            <Button icon={<Icon name="send" size={16} />} loading={busy} disabled={!text.trim()} onClick={() => void send()}>
              Send
            </Button>
          </div>
        </section>
      )}
      {error && !data ? (
        <Failed error={error} onRetry={reload} />
      ) : !data ? (
        <Skeleton height={64} radius={16} />
      ) : data.length ? (
        data.map((m) => (
          <div key={m.id} className={styles.message}>
            <p className={styles.messageText}>{m.text}</p>
            <span className={order.faint}>{`${m.author} · ${ago(m.at)}`}</span>
          </div>
        ))
      ) : (
        <p className={vendor.muted}>No messages yet. Write to the whole batch above.</p>
      )}
    </>
  );
}

function Files({ batch }: { batch: DeskBatchDetail }) {
  const { data, error, reload, setData } = useLoad(() => batchMaterials(batch.id), `f${batch.id}`);
  const [kind, setKind] = useState<"file" | "link">("file");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [picked, setPicked] = useState<File | null>(null);
  const [wholeCourse, setWholeCourse] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const key = useRef(newIdempotencyKey());
  const file = useRef<HTMLInputElement>(null);
  const owner = batch.role === "owner";
  const fileProblem = picked && !FILE_TYPES.includes(picked.type) ? "Only PDF, JPEG or PNG files" : picked && picked.size > MAX_FILE ? "Files up to 20 MB" : null;
  const ready = title.trim().length >= 2 && (kind === "file" ? !!picked && !fileProblem : /^https?:\/\/\S+$/.test(url.trim()));

  const add = async () => {
    setBusy("add");
    setFailure(null);
    try {
      const added =
        kind === "file"
          ? await uploadMaterial(batch.id, title.trim(), picked!, owner && wholeCourse, key.current)
          : await shareLink(batch.id, { title: title.trim(), url: url.trim(), ...(owner && wholeCourse ? { wholeCourse: true } : {}) }, key.current);
      key.current = newIdempotencyKey();
      setTitle("");
      setUrl("");
      setPicked(null);
      setData([added, ...(data ?? [])]);
    } catch (err) {
      setFailure(formError(err).message);
      if (!retryable(err)) key.current = newIdempotencyKey();
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string) => {
    setBusy(id);
    setFailure(null);
    try {
      await removeMaterial(id);
      setData((data ?? []).filter((m) => m.id !== id));
    } catch (err) {
      setFailure(formError(err).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      {batch.can.materials && (
        <section className={vendor.card}>
          <h2 className={vendor.section}>Share notes or a link</h2>
          <Segmented
            label="What"
            options={[
              { value: "file", label: "File" },
              { value: "link", label: "Link" },
            ]}
            value={kind}
            onChange={setKind}
          />
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="Name it, like “Chapter 3 notes”" />
          {kind === "file" ? (
            <div className={vendor.field}>
              <input
                ref={file}
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                hidden
                onChange={(e) => {
                  setPicked(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
              <div className={vendor.actions}>
                <Button variant="secondary" icon={<Icon name="download" size={16} />} onClick={() => file.current?.click()}>
                  {picked ? "Pick another file" : "Pick a file"}
                </Button>
                {picked && <span className={vendor.muted}>{`${picked.name} · ${sizeText(picked.size)}`}</span>}
              </div>
              <p className={fileProblem ? vendor.error : vendor.faint}>{fileProblem ?? "PDF, JPEG or PNG, up to 20 MB."}</p>
            </div>
          ) : (
            <Input label="Link" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} autoCapitalize="none" spellCheck={false} placeholder="https://" />
          )}
          {owner && (
            <div className={vendor.switches}>
              <Switch checked={wholeCourse} onChange={setWholeCourse} description="Every batch of this course sees it">
                For the whole course
              </Switch>
            </div>
          )}
          {failure && (
            <p className={vendor.error} role="alert">
              {failure}
            </p>
          )}
          <div className={vendor.actions}>
            <Button loading={busy === "add"} disabled={!ready} onClick={() => void add()}>
              Share
            </Button>
          </div>
        </section>
      )}
      {error && !data ? (
        <Failed error={error} onRetry={reload} />
      ) : !data ? (
        <Skeleton height={64} radius={16} />
      ) : data.length ? (
        <ul className={vendor.rows}>
          {data.map((m) => (
            <li key={m.id} className={vendor.row}>
              <Icon name={m.kind === "file" ? "download" : "share"} size={20} />
              <a href={m.url} target="_blank" rel="noreferrer" className={vendor.rowText}>
                <span className={vendor.rowTitle}>{m.title}</span>
                <span className={vendor.rowLine}>{[m.kind === "file" ? sizeText(m.bytes) : "Link", m.wholeCourse ? "Whole course" : null, `added ${dayText(m.addedAt)}`].filter(Boolean).join(" · ")}</span>
              </a>
              {batch.can.materials && (
                <Button variant="ghost" loading={busy === m.id} icon={<Icon name="trash" size={16} />} aria-label={`Remove ${m.title}`} onClick={() => void remove(m.id)} />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className={vendor.muted}>Nothing shared yet. Notes, worksheets and links for this batch show up here.</p>
      )}
    </>
  );
}

function BatchView({ batch, setBatch }: { batch: DeskBatchDetail; setBatch: (b: DeskBatchDetail) => void }) {
  const [tab, setTab] = useState<Tab>("classes");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now);
  const key = useRef(newIdempotencyKey());
  const status = BATCH_STATUS[batch.status];
  const running = batch.status !== "cancelled" && batch.status !== "ended";
  const last = batch.classes.at(-1);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(tick);
  }, []);

  const addClass = async (value: ClassTimeValue) => {
    setBusy(true);
    setFailure(null);
    try {
      setBatch(await addExtraClass(batch.id, { startsAt: value.startsAt, minutes: value.minutes }, key.current));
      key.current = newIdempotencyKey();
      setAdding(false);
    } catch (err) {
      setFailure(formError(err).message);
      if (!retryable(err)) key.current = newIdempotencyKey();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={vendor.page}>
      <Back href="/teach">Classes</Back>
      <div className={vendor.head}>
        <div className={vendor.identity}>
          <h1 className={vendor.title}>{batch.course.title}</h1>
          <span className={vendor.muted}>{`${batch.name} · ${batch.business.name}`}</span>
          <span className={vendor.muted}>{batch.schedule}</span>
          <span className={vendor.muted}>{`${batch.students} ${batch.students === 1 ? "student" : "students"}${batch.course.mode === "online" ? " · online" : ""}`}</span>
        </div>
        <Tag tone={batch.role === "coach" ? "neutral" : status.tone}>{batch.role === "coach" ? "Coach" : status.label}</Tag>
      </div>
      {batch.onlineLink && running && (
        <div className={vendor.actions}>
          <ButtonLink href={batch.onlineLink} target="_blank" rel="noreferrer" variant="secondary" icon={<Icon name="play" size={16} />}>
            Open the meeting link
          </ButtonLink>
        </div>
      )}

      <Segmented label="Show" options={TABS} value={tab} onChange={setTab} />

      {tab === "classes" && (
        <>
          <h2 className={vendor.section}>{`Classes · ${batch.classes.filter((c) => c.status !== "cancelled").length}`}</h2>
          <ClassRows batch={batch} now={now} />
          {batch.can.reschedule &&
            running &&
            (adding ? (
              <ClassTime
                title="Add an extra class"
                start={last ? new Date(Date.parse(last.startsAt) + 7 * 86_400_000).toISOString() : new Date(now + 86_400_000).toISOString()}
                minutes={batch.slots[0]?.minutes ?? 60}
                confirmLabel="Add class"
                busy={busy}
                failure={failure}
                onConfirm={(v) => void addClass(v)}
                onCancel={() => setAdding(false)}
              />
            ) : (
              <div className={vendor.actions}>
                <Button variant="secondary" icon={<Icon name="plus" size={16} />} onClick={() => setAdding(true)}>
                  Add an extra class
                </Button>
                <span className={vendor.faint}>To make up a cancelled one, or for revision.</span>
              </div>
            ))}
        </>
      )}
      {tab === "students" && <Students batchId={batch.id} />}
      {tab === "messages" && <Messages batch={batch} />}
      {tab === "files" && <Files batch={batch} />}
    </div>
  );
}

/** One batch for the owner or a coach: every class with attendance, and the batch's students, messages and files. Same as the app. */
export function TeachBatchScreen({ id }: { id: string }) {
  const { data, error, reload, setData } = useLoad(() => getDeskBatch(id), id);

  useEffect(() => {
    const onShow = () => document.visibilityState === "visible" && reload();
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, [reload]);

  if (data) return <BatchView batch={data} setBatch={setData} />;
  if (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
      return (
        <Empty title="Batch not found">
          <p>{formError(error).message}</p>
          <ButtonLink href="/teach" variant="secondary">
            Classes
          </ButtonLink>
        </Empty>
      );
    }
    return <Failed error={error} onRetry={reload} />;
  }
  return <Loading rows={5} />;
}
