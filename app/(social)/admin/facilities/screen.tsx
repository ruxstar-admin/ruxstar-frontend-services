"use client";

import { useEffect, useRef, useState } from "react";
import { Needs, useCan } from "@/components/admin/AdminFrame";
import { Failed, Rows, styles } from "@/components/admin/parts";
import { useOnSignedOut } from "@/components/social/session";
import { Button, Card, Input, Switch, Tag, useToast } from "@/components/ui";
import { formError } from "@/lib/api/account";
import { keepIdempotencyKey, newIdempotencyKey } from "@/lib/api/client";
import { consoleFacilities, createFacility, updateFacility, type ConsoleFacility } from "@/lib/api/stays";

const KEY = /^[a-z][a-z0-9_]{1,29}$/;
const keyOf = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^[^a-z]+|_+$/g, "")
    .slice(0, 30);
const orderOf = (text: string) => (/^\d{1,4}$/.test(text.trim()) && Number(text) <= 1000 ? Number(text) : null);

function FacilityRow({ facility, canManage, onSaved }: { facility: ConsoleFacility; canManage: boolean; onSaved: (f: ConsoleFacility) => void }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(facility.name);
  const [order, setOrder] = useState(String(facility.order));
  const [busy, setBusy] = useState(false);

  const save = async (body: { name?: string; active?: boolean; order?: number }) => {
    setBusy(true);
    try {
      onSaved(await updateFacility(facility.key, body));
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
          <span className={styles.name}>{facility.name}</span>
          <span className={`${styles.muted} ${styles.line}`}>{`${facility.key} · order ${facility.order}`}</span>
        </span>
        <span className={styles.tags}>{!facility.active && <Tag>Hidden</Tag>}</span>
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
              hint="Lower comes first in the filters and the owner’s list"
              error={position === null ? "A whole number from 0 to 1,000" : undefined}
            />
            <div className={styles.actions}>
              <Button
                variant="secondary"
                loading={busy}
                disabled={!nameOk || position === null || (name.trim() === facility.name && position === facility.order)}
                onClick={() => void save({ ...(name.trim() !== facility.name ? { name: name.trim() } : {}), ...(position !== facility.order ? { order: position! } : {}) })}
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
            <Switch
              checked={facility.active}
              disabled={busy}
              onChange={(on) => void save({ active: on })}
              description={facility.active ? "Owners can pick it and tenants filter by it" : "Properties that have it keep it"}
            >
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

function AddFacility({ next, onAdded }: { next: number; onAdded: (f: ConsoleFacility) => void }) {
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
      onAdded(await createFacility({ key: finalKey, name: name.trim(), order: next }, attempt.current));
      attempt.current = newIdempotencyKey();
      setName("");
      setKey("");
      setKeyTouched(false);
      toast("Facility added.", "success");
    } catch (err) {
      if (!keepIdempotencyKey(err)) attempt.current = newIdempotencyKey();
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card as="section" padding="lg" className={styles.group}>
      <h2 className={styles.subtitle}>Add a facility</h2>
      <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Like “Geyser”" />
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
          Add facility
        </Button>
      </div>
    </Card>
  );
}

/** The facilities PG and hostel owners pick from and tenants filter by, in order. */
export function FacilitiesScreen() {
  const onSignedOut = useOnSignedOut();
  const canManage = useCan("modules.manage");
  const [facilities, setFacilities] = useState<ConsoleFacility[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    consoleFacilities().then(
      (next) => live && setFacilities(next),
      (err) => live && !onSignedOut(err) && setError(err),
    );
    return () => {
      live = false;
    };
  }, [attempt, onSignedOut]);

  const put = (f: ConsoleFacility) =>
    setFacilities((all) => {
      const rest = (all ?? []).filter((x) => x.key !== f.key);
      return [...rest, f].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    });

  return (
    <Needs need="businesses.view">
      <div className={styles.page}>
        <h1 className={styles.title}>Facilities</h1>
        <p className={styles.muted}>PG and hostel owners pick from these; tenants filter by them. Hiding one keeps it on properties that have it.</p>
        {error ? (
          <Failed
            error={error}
            onRetry={() => {
              setError(null);
              setAttempt((n) => n + 1);
            }}
          />
        ) : !facilities ? (
          <Rows count={6} />
        ) : (
          <>
            {canManage && <AddFacility next={facilities.reduce((max, f) => Math.max(max, f.order), 0) + 10} onAdded={put} />}
            {facilities.length ? (
              <ul className={styles.list}>
                {facilities.map((f) => (
                  <FacilityRow key={f.key} facility={f} canManage={canManage} onSaved={put} />
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>No facilities yet.</p>
            )}
          </>
        )}
      </div>
    </Needs>
  );
}
