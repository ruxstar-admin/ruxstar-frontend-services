"use client";

import type { ReactNode } from "react";
import { Input, Segmented, Switch } from "@/components/ui";
import { cleanAmount, cleanCode, cleanCount, todayKey, type CouponDraft, type DraftErrors } from "@/lib/coupons";
import styles from "./coupons.module.css";

const KINDS = [
  { value: "percent", label: "Percent off" },
  { value: "flat", label: "Amount off" },
] as const;

interface CouponFieldsProps {
  draft: CouponDraft;
  onChange: (next: CouponDraft) => void;
  errors: DraftErrors;
  /** Making a new coupon: the code and discount can be set. Afterwards they are fixed. */
  creating: boolean;
  /** A coupon that hasn't started can still move its start. */
  canMoveStart: boolean;
  /** Vendors pick which of their print shops it works at. */
  shops?: { id: string; name: string }[];
}

function Group({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className={styles.group} role="group" aria-label={label}>
      <span className={styles.label}>{label}</span>
      {children}
      {(error || hint) && <p className={error ? styles.error : styles.hint}>{error ?? hint}</p>}
    </div>
  );
}

/** The coupon form's fields, same as the app. Amounts are typed in rupees; days are whole days in India time. */
export function CouponFields({ draft, onChange, errors, creating, canMoveStart, shops }: CouponFieldsProps) {
  const set = <K extends keyof CouponDraft>(key: K, value: CouponDraft[K]) => onChange({ ...draft, [key]: value });
  const percent = draft.kind === "percent";
  const today = todayKey();

  return (
    <div className={styles.form}>
      {creating && (
        <>
          <Input
            label="Code"
            value={draft.code}
            onChange={(e) => set("code", cleanCode(e.target.value))}
            placeholder="WELCOME20"
            autoComplete="off"
            spellCheck={false}
            hint="What customers type. 4 to 16 letters and digits. It can't change later."
            error={draft.code ? errors.code : undefined}
          />
          <Group label="Discount">
            <Segmented label="Discount" options={KINDS} value={draft.kind} onChange={(kind) => onChange({ ...draft, kind, value: "", cap: "" })} />
          </Group>
          <div className={styles.pair}>
            <Input
              label={percent ? "Percent off" : "Amount off"}
              prefix={percent ? undefined : "₹"}
              suffix={percent ? "%" : undefined}
              inputMode={percent ? "numeric" : "decimal"}
              value={draft.value}
              onChange={(e) => set("value", percent ? cleanCount(e.target.value).slice(0, 3) : cleanAmount(e.target.value))}
              error={draft.value ? errors.value : undefined}
            />
            {percent && (
              <Input
                label="Most off"
                prefix="₹"
                inputMode="decimal"
                placeholder="No most"
                value={draft.cap}
                onChange={(e) => set("cap", cleanAmount(e.target.value))}
                error={errors.cap}
              />
            )}
          </div>
        </>
      )}

      {shops && (
        <Group label="Works at" error={errors.shops}>
          <div className={styles.chips}>
            {shops.map((s) => {
              const on = draft.businessIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  className={styles.chip}
                  aria-pressed={on}
                  onClick={() => set("businessIds", on ? draft.businessIds.filter((id) => id !== s.id) : [...draft.businessIds, s.id])}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        </Group>
      )}

      <Input
        label="Smallest order"
        prefix="₹"
        inputMode="decimal"
        placeholder="None"
        value={draft.minOrder}
        onChange={(e) => set("minOrder", cleanAmount(e.target.value))}
        hint="Of the items, before the discount and the platform fee"
        error={errors.minOrder}
      />

      <div className={styles.pair}>
        {(creating || canMoveStart) && (
          <Input
            label="Starts"
            type="date"
            min={today}
            value={draft.starts}
            onChange={(e) => onChange({ ...draft, starts: e.target.value, ends: draft.ends && draft.ends < e.target.value ? "" : draft.ends })}
            hint="Empty: today"
            error={errors.starts}
          />
        )}
        <Input
          label="Ends"
          type="date"
          min={draft.starts && draft.starts > today ? draft.starts : today}
          value={draft.ends}
          onChange={(e) => set("ends", e.target.value)}
          hint="Empty: no end date. It works until the end of that day."
          error={errors.ends}
        />
      </div>

      <div className={styles.pair}>
        <Input label="Total uses" inputMode="numeric" placeholder="No limit" value={draft.limit} onChange={(e) => set("limit", cleanCount(e.target.value))} error={errors.limit} />
        <Input
          label="Uses per customer"
          inputMode="numeric"
          placeholder="No limit"
          value={draft.perCustomer}
          onChange={(e) => set("perCustomer", cleanCount(e.target.value).slice(0, 3))}
          error={errors.perCustomer}
        />
      </div>

      <div className={styles.switches}>
        <Switch checked={draft.firstOrderOnly} onChange={(v) => set("firstOrderOnly", v)} description="For customers who haven't ordered before">
          First order only
        </Switch>
        <Switch checked={draft.listed} onChange={(v) => set("listed", v)} description="Off: only people you give the code to can use it">
          Show at checkout
        </Switch>
      </div>
    </div>
  );
}
