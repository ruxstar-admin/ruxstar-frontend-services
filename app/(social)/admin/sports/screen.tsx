"use client";

import { useEffect, useRef, useState } from "react";
import { Needs, useCan } from "@/components/admin/AdminFrame";
import { Failed, Rows, styles } from "@/components/admin/parts";
import { useOnSignedOut } from "@/components/social/session";
import { Button, Card, Input, Switch, Tag, useToast } from "@/components/ui";
import { formError } from "@/lib/api/account";
import { ApiError, newIdempotencyKey } from "@/lib/api/client";
import { consoleSports, createSport, updateSport, type ConsoleSport } from "@/lib/api/turf";

const KEY = /^[a-z][a-z0-9_]{1,29}$/;
const keyOf = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^[^a-z]+|_+$/g, "")
    .slice(0, 30);
const orderOf = (text: string) => (/^\d{1,4}$/.test(text.trim()) && Number(text) <= 1000 ? Number(text) : null);

function SportRow({ sport, canManage, onSaved }: { sport: ConsoleSport; canManage: boolean; onSaved: (s: ConsoleSport) => void }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(sport.name);
  const [order, setOrder] = useState(String(sport.order));
  const [busy, setBusy] = useState(false);

  const save = async (body: { name?: string; active?: boolean; order?: number }) => {
    setBusy(true);
    try {
      onSaved(await updateSport(sport.key, body));
      setEditing(false);
    } catch (err) {
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setBusy(false);
    }
  };

  const nameOk = name.trim().length >= 2 && name.trim().length <= 40;
  const position = orderOf(order);

  return (
    <li className={styles.item}>
      <div className={styles.row}>
        <span className={styles.whoRow}>
          <span className={styles.name}>{sport.name}</span>
          <span className={`${styles.muted} ${styles.line}`}>{`${sport.key} · order ${sport.order}`}</span>
        </span>
        <span className={styles.tags}>{!sport.active && <Tag>Hidden</Tag>}</span>
      </div>
      {canManage &&
        (editing ? (
          <div className={styles.group}>
            <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} error={nameOk ? undefined : "2 to 40 characters"} />
            <Input
              label="Order"
              inputMode="numeric"
              value={order}
              onChange={(e) => setOrder(e.target.value.replace(/\D/g, ""))}
              maxLength={4}
              hint="Lower comes first in the sport chips"
              error={position === null ? "A whole number from 0 to 1,000" : undefined}
            />
            <div className={styles.actions}>
              <Button
                variant="secondary"
                loading={busy}
                disabled={!nameOk || position === null || (name.trim() === sport.name && position === sport.order)}
                onClick={() => void save({ ...(name.trim() !== sport.name ? { name: name.trim() } : {}), ...(position !== sport.order ? { order: position! } : {}) })}
              >
                Save
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className={styles.actions}>
            <Switch checked={sport.active} disabled={busy} onChange={(on) => void save({ active: on })} description={sport.active ? "Owners can pick it and players filter by it" : "Courts that have it keep it"}>
              Shown
            </Switch>
            <Button variant="ghost" onClick={() => setEditing(true)}>
              Rename or reorder
            </Button>
          </div>
        ))}
    </li>
  );
}

function AddSport({ next, onAdded }: { next: number; onAdded: (s: ConsoleSport) => void }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const attempt = useRef(newIdempotencyKey());
  const finalKey = keyTouched ? key : keyOf(name);
  const nameOk = name.trim().length >= 2 && name.trim().length <= 40;
  const keyOk = KEY.test(finalKey);

  const add = async () => {
    setBusy(true);
    try {
      onAdded(await createSport({ key: finalKey, name: name.trim(), order: next }, attempt.current));
      attempt.current = newIdempotencyKey();
      setName("");
      setKey("");
      setKeyTouched(false);
      toast("Sport added.", "success");
    } catch (err) {
      if (!(err instanceof ApiError && err.code === "NETWORK")) attempt.current = newIdempotencyKey();
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card as="section" padding="lg" className={styles.group}>
      <h2 className={styles.subtitle}>Add a sport</h2>
      <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Like “Pickleball”" />
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
      <div>
        <Button variant="secondary" loading={busy} disabled={!nameOk || !keyOk} onClick={() => void add()}>
          Add sport
        </Button>
      </div>
    </Card>
  );
}

/** The sports owners pick for their courts and players filter by, in order. Same as the app. */
export function SportsScreen() {
  const onSignedOut = useOnSignedOut();
  const canManage = useCan("modules.manage");
  const [sports, setSports] = useState<ConsoleSport[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    consoleSports().then(
      (next) => live && setSports(next),
      (err) => live && !onSignedOut(err) && setError(err),
    );
    return () => {
      live = false;
    };
  }, [attempt, onSignedOut]);

  const put = (s: ConsoleSport) =>
    setSports((all) => {
      const rest = (all ?? []).filter((x) => x.key !== s.key);
      return [...rest, s].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    });

  return (
    <Needs need="businesses.view">
      <div className={styles.page}>
        <h1 className={styles.title}>Sports</h1>
        <p className={styles.muted}>Owners pick from these for each court; players filter grounds by them. Hiding one keeps it on courts that have it.</p>
        {error ? (
          <Failed
            error={error}
            onRetry={() => {
              setError(null);
              setAttempt((n) => n + 1);
            }}
          />
        ) : !sports ? (
          <Rows count={6} />
        ) : (
          <>
            {canManage && <AddSport next={sports.reduce((max, s) => Math.max(max, s.order), 0) + 10} onAdded={put} />}
            {sports.length ? (
              <ul className={styles.list}>
                {sports.map((s) => (
                  <SportRow key={s.key} sport={s} canManage={canManage} onSaved={put} />
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>No sports yet.</p>
            )}
          </>
        )}
      </div>
    </Needs>
  );
}
