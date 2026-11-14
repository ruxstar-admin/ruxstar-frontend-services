"use client";

import { Input, Segmented } from "@/components/ui";
import { PAY_NOTE_MAX, PAY_PER, type Pay, type PayPer } from "@/lib/api/team";
import { paiseOf, rupeeInput, rupeesText } from "@/lib/api/vendor";
import styles from "./team.module.css";

/** What the owner is typing. An empty amount means no pay on the offer. */
export interface PayDraft {
  amount: string;
  per: PayPer;
  note: string;
}

export const payDraft = (pay: Pay | null): PayDraft => ({ amount: rupeesText(pay?.amount), per: pay?.per ?? "month", note: pay?.note ?? "" });

export function payOfDraft(draft: PayDraft): Pay | null {
  const amount = paiseOf(draft.amount);
  return amount ? { amount, per: draft.per, note: draft.note.trim() || null } : null;
}

/** Under ₹1 can't be sent; empty is fine, since pay is optional. */
export const payDraftOk = (draft: PayDraft) => !draft.amount.trim() || (paiseOf(draft.amount) ?? 0) >= 100;

const PER_OPTIONS = PAY_PER.map((p) => ({ value: p.key, label: p.label }));

/** Pay on a team invite: an amount, how often, and an optional note. All optional. Same as the app. */
export function PayFields({ value, onChange, error, disabled }: { value: PayDraft; onChange: (next: PayDraft) => void; error?: string; disabled?: boolean }) {
  const tooLow = !payDraftOk(value);
  return (
    <div className={styles.picker}>
      <h2 className={styles.section}>Pay (optional)</h2>
      <p className={styles.muted}>They see it with the invite, so they can compare offers. You pay them yourself; Ruxstar only shows it.</p>
      <Input
        label="Amount"
        value={value.amount}
        onChange={(e) => onChange({ ...value, amount: rupeeInput(e.target.value) })}
        prefix="₹"
        inputMode="decimal"
        placeholder="15000"
        disabled={disabled}
        error={error ?? (tooLow ? "Enter at least ₹1, or leave it empty" : undefined)}
      />
      {value.amount.trim() && (
        <>
          <span className={styles.label}>Paid per</span>
          <Segmented label="Paid per" options={PER_OPTIONS} value={value.per} onChange={(per) => onChange({ ...value, per })} />
          <Input
            label="Note (optional)"
            value={value.note}
            onChange={(e) => onChange({ ...value, note: e.target.value })}
            placeholder="Plus petrol allowance"
            maxLength={PAY_NOTE_MAX}
            disabled={disabled}
          />
        </>
      )}
    </div>
  );
}
