"use client";

import { useEffect, useRef, useState } from "react";
import { Needs, useCan } from "@/components/admin/AdminFrame";
import { Failed, Rows, styles } from "@/components/admin/parts";
import { useOnSignedOut } from "@/components/social/session";
import { Button, Card, Input, Switch, Tag, useToast } from "@/components/ui";
import { TextArea } from "@/components/vendor/parts";
import { formError } from "@/lib/api/account";
import { ApiError, newIdempotencyKey } from "@/lib/api/client";
import { bannedCategories, createBanned, updateBanned, type BannedCategory } from "@/lib/api/store";

const KEY = /^[a-z][a-z0-9_]{1,29}$/;
const MAX_WORDS = 100;
const keyOf = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^[^a-z]+|_+$/g, "")
    .slice(0, 30);

/** One word or phrase per line or comma; the same clean-up the server does. */
const wordsOf = (text: string) => [...new Set(text.split(/[\n,]/).map((w) => w.trim().toLowerCase().replace(/\s+/g, " ")).filter(Boolean))];
function wordsProblem(words: string[]): string | null {
  if (!words.length) return "Add at least one word";
  if (words.length > MAX_WORDS) return `Up to ${MAX_WORDS} words`;
  const bad = words.find((w) => w.length < 2 || w.length > 40);
  return bad ? `“${bad.slice(0, 20)}” must be 2 to 40 characters` : null;
}
const nameOk = (name: string) => name.trim().length >= 2 && name.trim().length <= 60;

function BannedRow({ item, canManage, onSaved }: { item: BannedCategory; canManage: boolean; onSaved: (b: BannedCategory) => void }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [text, setText] = useState(item.words.join("\n"));
  const [busy, setBusy] = useState(false);
  const words = wordsOf(text);
  const problem = wordsProblem(words);
  const wordsChanged = words.join("\n") !== item.words.join("\n");

  const save = async (body: { name?: string; words?: string[]; active?: boolean }) => {
    setBusy(true);
    try {
      onSaved(await updateBanned(item.key, body));
      setEditing(false);
    } catch (err) {
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={styles.item}>
      <div className={styles.row}>
        <span className={styles.whoRow}>
          <span className={styles.name}>{item.name}</span>
          <span className={`${styles.muted} ${styles.line}`}>{`${item.key} · ${item.words.length} ${item.words.length === 1 ? "word" : "words"}`}</span>
          <span className={`${styles.muted} ${styles.line}`}>{item.words.join(", ")}</span>
        </span>
        <span className={styles.tags}>{!item.active && <Tag>Not checked</Tag>}</span>
      </div>
      {canManage &&
        (editing ? (
          <div className={styles.group}>
            <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} error={nameOk(name) ? undefined : "2 to 60 characters"} />
            <TextArea label="Words and phrases, one per line" value={text} onChange={setText} max={4000} />
            {problem && (
              <p className={styles.muted} role="alert">
                {problem}
              </p>
            )}
            <div className={styles.actions}>
              <Button
                variant="secondary"
                loading={busy}
                disabled={!nameOk(name) || !!problem || (name.trim() === item.name && !wordsChanged)}
                onClick={() => void save({ ...(name.trim() !== item.name ? { name: name.trim() } : {}), ...(wordsChanged ? { words } : {}) })}
              >
                Save
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setName(item.name);
                  setText(item.words.join("\n"));
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className={styles.actions}>
            <Switch
              checked={item.active}
              disabled={busy}
              onChange={(on) => void save({ active: on })}
              description={item.active ? "New and changed products using these are refused" : "Not checked; products saved meanwhile stay"}
            >
              Checked
            </Switch>
            <Button variant="ghost" onClick={() => setEditing(true)}>
              Change words
            </Button>
          </div>
        ))}
    </li>
  );
}

function AddBanned({ onAdded }: { onAdded: (b: BannedCategory) => void }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const attempt = useRef(newIdempotencyKey());
  const finalKey = keyTouched ? key : keyOf(name);
  const keyOk = KEY.test(finalKey);
  const words = wordsOf(text);
  const problem = text.trim() ? wordsProblem(words) : null;

  const add = async () => {
    setBusy(true);
    try {
      onAdded(await createBanned({ key: finalKey, name: name.trim(), words }, attempt.current));
      attempt.current = newIdempotencyKey();
      setName("");
      setKey("");
      setKeyTouched(false);
      setText("");
      toast("Category added. New and changed products are checked against it from now.", "success");
    } catch (err) {
      if (!(err instanceof ApiError && err.code === "NETWORK")) attempt.current = newIdempotencyKey();
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card as="section" padding="lg" className={styles.group}>
      <h2 className={styles.subtitle}>Add a category</h2>
      <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Like “Fireworks”" />
      <Input
        label="Key"
        value={finalKey}
        onChange={(e) => {
          setKeyTouched(true);
          setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""));
        }}
        maxLength={30}
        hint="Lowercase letters, numbers and _. It can’t change later."
        error={finalKey && !keyOk ? "Start with a letter; 2 to 30 characters" : undefined}
      />
      <TextArea label="Words and phrases, one per line" value={text} onChange={setText} max={4000} placeholder={"firecracker\nsky shot"} />
      {problem && (
        <p className={styles.muted} role="alert">
          {problem}
        </p>
      )}
      <div>
        <Button variant="secondary" loading={busy} disabled={!nameOk(name) || !keyOk || !words.length || !!problem} onClick={() => void add()}>
          Add category
        </Button>
      </div>
    </Card>
  );
}

/** The banned categories list: words and phrases local shop products can't use in their title, description or options. */
export function BannedScreen() {
  const onSignedOut = useOnSignedOut();
  const canManage = useCan("modules.manage");
  const [items, setItems] = useState<BannedCategory[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    bannedCategories().then(
      (next) => live && setItems(next),
      (err) => live && !onSignedOut(err) && setError(err),
    );
    return () => {
      live = false;
    };
  }, [attempt, onSignedOut]);

  const put = (b: BannedCategory) =>
    setItems((all) => {
      const rest = (all ?? []).filter((x) => x.key !== b.key);
      return [...rest, b].sort((x, y) => x.name.localeCompare(y.name));
    });

  return (
    <Needs need="businesses.view">
      <div className={styles.page}>
        <h1 className={styles.title}>Banned categories</h1>
        <p className={styles.muted}>
          A local shop product whose title, description or options use one of these words is refused, and the owner is told which. Products saved before a word was added stay until
          they’re taken down.
        </p>
        {error ? (
          <Failed
            error={error}
            onRetry={() => {
              setError(null);
              setAttempt((n) => n + 1);
            }}
          />
        ) : !items ? (
          <Rows count={6} />
        ) : (
          <>
            {canManage && <AddBanned onAdded={put} />}
            {items.length ? (
              <ul className={styles.list}>
                {items.map((b) => (
                  <BannedRow key={`${b.key}:${b.updatedAt}`} item={b} canManage={canManage} onSaved={put} />
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>No categories yet.</p>
            )}
          </>
        )}
      </div>
    </Needs>
  );
}
