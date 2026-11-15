"use client";

import { useRef, useState } from "react";
import { Button, Icon, Input } from "@/components/ui";
import { useLoad } from "@/components/vendor/use-load";
import { formError } from "@/lib/api/account";
import { ApiError, newIdempotencyKey } from "@/lib/api/client";
import { addChild, myChildren, type Child, type Slot } from "@/lib/api/coaching";
import { money } from "@/lib/api/shops";
import { DAY_LONG, DAY_SHORT, WEEK } from "@/lib/coaching";
import order from "@/components/shop/order.module.css";
import events from "@/components/events/events.module.css";
import styles from "./coaching.module.css";

/** Seven small boxes, Monday first, lit on the days a batch meets. */
export function WeekDays({ slots }: { slots: Slot[] }) {
  const on = new Set(slots.map((s) => s.day));
  return (
    <ul className={styles.week} aria-label={`Meets on ${WEEK.filter((d) => on.has(d)).map((d) => DAY_LONG[d]).join(", ")}`}>
      {WEEK.map((d) => (
        <li key={d} data-on={on.has(d) || undefined} aria-hidden>
          {DAY_SHORT[d]!.charAt(0)}
        </li>
      ))}
    </ul>
  );
}

export function StepBar({ steps, at }: { steps: readonly string[]; at: number }) {
  return (
    <ol className={events.steps} aria-label="Steps">
      {steps.map((s, i) => (
        <li key={s} aria-current={i === at ? "step" : undefined} data-done={i < at || undefined}>
          {s}
        </li>
      ))}
    </ol>
  );
}

export function PriceLine({ label, amount, strong, minus }: { label: string; amount: number; strong?: boolean; minus?: boolean }) {
  return (
    <div className={strong ? `${order.priceRow} ${order.total}` : order.priceRow}>
      <dt>{label}</dt>
      <dd>{amount === 0 && !minus ? "Free" : `${minus ? "− " : ""}${money(amount)}`}</dd>
    </div>
  );
}

const THIS_YEAR = new Date().getFullYear();

/** Adding a child by name, and a birth year if the parent wants. Shared by the picker and the children page. */
export function ChildForm({ onAdded, onCancel }: { onAdded: (child: Child) => void; onCancel?: () => void }) {
  const [name, setName] = useState("");
  const [year, setYear] = useState("");
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const key = useRef(newIdempotencyKey());

  const yearNumber = year.trim() ? Number(year) : null;
  const errors = {
    name: name.trim().length < 2 ? "Their name, as it goes on the certificate" : undefined,
    year: yearNumber !== null && !(Number.isInteger(yearNumber) && yearNumber >= 1990 && yearNumber <= THIS_YEAR) ? `A year from 1990 to ${THIS_YEAR}` : undefined,
  };

  const save = async () => {
    setShown(true);
    if (errors.name || errors.year) return;
    setBusy(true);
    setFailure(null);
    try {
      const child = await addChild({ name: name.trim(), birthYear: yearNumber }, key.current);
      key.current = newIdempotencyKey();
      setName("");
      setYear("");
      setShown(false);
      onAdded(child);
    } catch (err) {
      setFailure(formError(err).message);
      if (!(err instanceof ApiError && err.code === "NETWORK")) key.current = newIdempotencyKey();
    } finally {
      setBusy(false);
    }
  };

  return (
    <fieldset className={events.person}>
      <h3>Add a child</h3>
      <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="off" error={shown ? errors.name : undefined} />
      <Input
        label="Birth year (optional)"
        inputMode="numeric"
        value={year}
        onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
        hint="Helps the institute put them in the right batch."
        error={shown ? errors.year : undefined}
      />
      {failure && (
        <p className={order.error} role="alert">
          {failure}
        </p>
      )}
      <div className={order.actions}>
        <Button loading={busy} onClick={() => void save()}>
          Add
        </Button>
        {onCancel && (
          <Button variant="ghost" disabled={busy} onClick={onCancel}>
            Not now
          </Button>
        )}
      </div>
    </fieldset>
  );
}

/**
 * Who the class is for: you, or one of your children, with adding a child right here. `blocked` says why a student
 * can't be picked (already enrolled, demo taken), or null.
 */
export function StudentPicker({
  meName,
  value,
  onChange,
  blocked,
}: {
  meName: string;
  /** undefined: nobody picked yet. null: you. */
  value: string | null | undefined;
  onChange: (childId: string | null, name: string) => void;
  blocked: (childId: string | null) => string | null;
}) {
  const children = useLoad(() => myChildren(), "children");
  const [adding, setAdding] = useState(false);
  const list = children.data ?? [];

  const option = (childId: string | null, name: string, line: string) => {
    const why = blocked(childId);
    return (
      <li key={childId ?? "me"}>
        <button type="button" role="radio" className={styles.choice} aria-checked={value === childId} disabled={!!why} onClick={() => onChange(childId, name)}>
          <span className={styles.radio} aria-hidden />
          <span className={styles.choiceText}>
            <span className={styles.choiceTitle}>{name}</span>
            <span className={order.small}>{why ?? line}</span>
          </span>
        </button>
      </li>
    );
  };

  return (
    <div className={order.section}>
      <ul className={styles.choices} role="radiogroup" aria-label="Who is it for">
        {option(null, meName, "You")}
        {list.map((c) => option(c.id, c.name, c.birthYear ? `Your child · born ${c.birthYear}` : "Your child"))}
      </ul>
      {children.error ? (
        <p className={order.error} role="alert">
          {`${formError(children.error).message} `}
          <button type="button" className={events.textLink} onClick={children.reload}>
            Try again
          </button>
        </p>
      ) : adding ? (
        <ChildForm
          onCancel={() => setAdding(false)}
          onAdded={(child) => {
            children.setData((all) => [...(all ?? []), child]);
            setAdding(false);
            onChange(child.id, child.name);
          }}
        />
      ) : (
        <div>
          <Button variant="secondary" icon={<Icon name="plus" size={16} />} onClick={() => setAdding(true)} disabled={!children.data}>
            Add a child
          </Button>
        </div>
      )}
    </div>
  );
}
