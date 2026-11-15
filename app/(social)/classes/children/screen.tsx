"use client";

import { useState } from "react";
import { Button, Icon, Input, Skeleton } from "@/components/ui";
import { Back, Failed } from "@/components/vendor/parts";
import { ChildForm } from "@/components/coaching/parts";
import { useLoad } from "@/components/vendor/use-load";
import { formError } from "@/lib/api/account";
import { myChildren, removeChild, updateChild, type Child } from "@/lib/api/coaching";
import order from "@/components/shop/order.module.css";
import events from "@/components/events/events.module.css";

const THIS_YEAR = new Date().getFullYear();

function ChildRow({ child, onSaved, onRemoved }: { child: Child; onSaved: (c: Child) => void; onRemoved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(child.name);
  const [year, setYear] = useState(child.birthYear ? String(child.birthYear) : "");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const yearNumber = year.trim() ? Number(year) : null;
  const nameError = name.trim().length < 2 ? "Their name, as it goes on the certificate" : undefined;
  const yearError = yearNumber !== null && !(yearNumber >= 1990 && yearNumber <= THIS_YEAR) ? `A year from 1990 to ${THIS_YEAR}` : undefined;

  const save = async () => {
    if (nameError || yearError) return;
    setBusy(true);
    setError(null);
    try {
      onSaved(await updateChild(child.id, { name: name.trim(), birthYear: yearNumber }));
      setEditing(false);
    } catch (err) {
      setError(formError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await removeChild(child.id);
      onRemoved();
    } catch (err) {
      setError(formError(err).message);
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <fieldset className={events.person}>
        <h3>{`Edit ${child.name}`}</h3>
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="off" error={nameError} />
        <Input
          label="Birth year (optional)"
          inputMode="numeric"
          value={year}
          onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
          error={yearError}
        />
        {child.enrolments > 0 && <p className={order.faint}>A new name shows on certificates issued from now on.</p>}
        {error && (
          <p className={order.error} role="alert">
            {error}
          </p>
        )}
        <div className={order.actions}>
          <Button loading={busy} disabled={Boolean(nameError || yearError)} onClick={() => void save()}>
            Save
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </fieldset>
    );
  }

  return (
    <div className={order.panel}>
      <div className={order.row}>
        <span className={order.rowIcon}>
          <Icon name="user" size={20} />
        </span>
        <span className={order.rowText}>
          <span className={order.rowTitle}>{child.name}</span>
          <span className={order.faint}>
            {[child.birthYear ? `Born ${child.birthYear}` : null, child.enrolments ? `${child.enrolments} open ${child.enrolments === 1 ? "class" : "classes"}` : "No classes"].filter(Boolean).join(" · ")}
          </span>
        </span>
        <Button variant="ghost" icon={<Icon name="edit" size={16} />} onClick={() => setEditing(true)} aria-label={`Edit ${child.name}`} />
      </div>
      {error && (
        <p className={order.error} role="alert">
          {error}
        </p>
      )}
      {confirming ? (
        <div className={order.actions}>
          <Button variant="danger" loading={busy} onClick={() => void remove()}>
            {`Remove ${child.name}`}
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
            Keep
          </Button>
        </div>
      ) : child.enrolments > 0 ? (
        <span className={order.faint}>Children with an open enrolment or demo can’t be removed.</span>
      ) : (
        <button type="button" className={events.textLink} data-danger onClick={() => setConfirming(true)}>
          Remove
        </button>
      )}
    </div>
  );
}

/** The children you enrol in classes. Their attendance and certificates stay with you. */
export function ChildrenScreen() {
  const { data, error, reload, setData } = useLoad(() => myChildren(), "children");
  const [adding, setAdding] = useState(false);

  return (
    <div className={order.page}>
      <Back href="/classes">Your classes</Back>
      <h1 className={order.title}>Your children</h1>
      <p className={order.small}>Enrol them in batches and demo classes from your account. Classes, attendance and certificates are kept under their name.</p>
      {error && !data ? (
        <Failed error={error} onRetry={reload} />
      ) : !data ? (
        <Skeleton height={84} radius={16} />
      ) : (
        <>
          {data.length === 0 && !adding && <p className={order.small}>No children added yet.</p>}
          {data.map((c) => (
            <ChildRow
              key={c.id}
              child={c}
              onSaved={(next) => setData(data.map((x) => (x.id === next.id ? next : x)))}
              onRemoved={() => setData(data.filter((x) => x.id !== c.id))}
            />
          ))}
          {adding ? (
            <ChildForm
              onAdded={(child) => {
                setData([...data, child]);
                setAdding(false);
              }}
              onCancel={() => setAdding(false)}
            />
          ) : (
            <Button variant="secondary" icon={<Icon name="plus" size={16} />} onClick={() => setAdding(true)}>
              Add a child
            </Button>
          )}
        </>
      )}
    </div>
  );
}
