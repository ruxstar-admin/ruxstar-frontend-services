"use client";

import { useState } from "react";
import { Button, Icon, Input, Segmented, Tag } from "@/components/ui";
import { useOnSignedOut } from "@/components/social/session";
import { Failed, Loading } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { formError } from "@/lib/api/account";
import { ApiError } from "@/lib/api/client";
import { money } from "@/lib/api/shops";
import { digitsOnly, setPayoutMethod, vendorPayments, type PayoutMethod } from "@/lib/api/vendor";
import { ago, exact } from "@/lib/time";
import styles from "@/components/vendor/vendor.module.css";

const KINDS = [
  { value: "bank", label: "Bank account" },
  { value: "upi", label: "UPI ID" },
] as const;
const ACCOUNT = /^[0-9]{9,18}$/;
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const VPA = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,64}$/;

const PAYOUT_STATUS = {
  paid: { label: "Paid", tone: "success" },
  pending: { label: "On the way", tone: "warning" },
  failed: { label: "Failed", tone: "danger" },
} as const;

type Field = "accountNumber" | "confirm" | "ifsc" | "vpa";

function MethodForm({ onSaved, onCancel }: { onSaved: (method: PayoutMethod) => void; onCancel?: () => void }) {
  const onSignedOut = useOnSignedOut();
  const [kind, setKind] = useState<(typeof KINDS)[number]["value"]>("bank");
  const [values, setValues] = useState<Record<Field, string>>({ accountNumber: "", confirm: "", ifsc: "", vpa: "" });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (field: Field) => (text: string) => {
    const value = field === "ifsc" ? text.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11) : field === "vpa" ? text.trim() : digitsOnly(text, 18);
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((x) => ({ ...x, [field]: undefined }));
  };

  const save = async () => {
    const found: Partial<Record<Field, string>> = {};
    if (kind === "bank") {
      if (!ACCOUNT.test(values.accountNumber)) found.accountNumber = "Account numbers have 9 to 18 digits.";
      else if (values.confirm !== values.accountNumber) found.confirm = "The two numbers do not match.";
      if (!IFSC.test(values.ifsc)) found.ifsc = "An IFSC has 11 characters, like YESB0000262.";
    } else if (!VPA.test(values.vpa)) found.vpa = "A UPI ID looks like name@okhdfc.";
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      const saved = await setPayoutMethod(kind === "bank" ? { kind, accountNumber: values.accountNumber, ifsc: values.ifsc } : { kind, vpa: values.vpa });
      if (saved) onSaved(saved);
    } catch (err) {
      if (onSignedOut(err)) return;
      const detail = err instanceof ApiError ? err.details.find((d) => d.path?.endsWith("accountNumber") || d.path?.endsWith("vpa")) : undefined;
      if (detail) setErrors({ [kind === "bank" ? "accountNumber" : "vpa"]: detail.message });
      else setFailure(formError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className={`${styles.card} ${styles.form}`}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <Segmented label="Where you get paid" options={KINDS} value={kind} onChange={setKind} />
      {kind === "bank" ? (
        <>
          <Input
            label="Account number"
            type="password"
            value={values.accountNumber}
            onChange={(e) => set("accountNumber")(e.target.value)}
            inputMode="numeric"
            autoComplete="off"
            maxLength={18}
            error={errors.accountNumber}
          />
          <Input
            label="Account number again"
            value={values.confirm}
            onChange={(e) => set("confirm")(e.target.value)}
            inputMode="numeric"
            autoComplete="off"
            maxLength={18}
            error={errors.confirm}
          />
          <Input
            label="IFSC"
            value={values.ifsc}
            onChange={(e) => set("ifsc")(e.target.value)}
            placeholder="YESB0000262"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={11}
            error={errors.ifsc}
          />
        </>
      ) : (
        <Input
          label="UPI ID"
          value={values.vpa}
          onChange={(e) => set("vpa")(e.target.value)}
          placeholder="name@okhdfc"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          error={errors.vpa}
        />
      )}
      <p className={styles.faint}>
        {kind === "bank"
          ? "We check the account with your bank. It must be in the name on your Aadhaar. Only the last 4 digits are shown again."
          : "We send ₹1 to check it. It must be in the name on your Aadhaar."}
      </p>
      {failure && (
        <p className={styles.error} role="alert">
          {failure}
        </p>
      )}
      <div className={styles.actions}>
        <Button type="submit" loading={saving}>
          Check and save
        </Button>
        {onCancel && (
          <Button variant="ghost" disabled={saving} onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

/** Balance, where the vendor is paid, and their payouts. Same as the app. */
export function PaymentsScreen() {
  const { data, error, reload, setData } = useLoad(vendorPayments);
  const [changing, setChanging] = useState(false);

  if (error && !data) return <Failed error={error} onRetry={reload} />;
  if (!data) return <Loading />;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Payments</h1>
      <div className={styles.card}>
        <dl className={styles.stats}>
          <div>
            <dt>Available</dt>
            <dd>{money(data.balance.available)}</dd>
          </div>
          <div>
            <dt>Pending</dt>
            <dd>{money(data.balance.pending)}</dd>
          </div>
          <div>
            <dt>Paid out</dt>
            <dd>{money(data.balance.paidOut)}</dd>
          </div>
        </dl>
        <p className={styles.faint}>Pending is your share of paid orders. It becomes available 48 hours after delivery, or once Ruxstar settles a problem a customer reported.</p>
      </div>

      {data.upcoming.length > 0 && (
        <>
          <h2 className={styles.overline}>Coming up</h2>
          <ul className={`${styles.card} ${styles.payouts}`}>
            {data.upcoming.map((u) => (
              <li key={u.orderId}>
                <span className={styles.identity}>
                  <strong>{money(u.amount)}</strong>
                  <span className={styles.muted}>{u.held ? `Order #${u.orderNo} · held for a reported problem` : `Order #${u.orderNo} · available ${exact(u.availableAt)}`}</span>
                </span>
                <Tag tone={u.held ? "warning" : "neutral"}>{u.held ? "Held" : "Waiting"}</Tag>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className={styles.overline}>Where you get paid</h2>
      {data.payoutMethod && !changing ? (
        <div className={styles.card}>
          <div className={styles.method}>
            <Icon name={data.payoutMethod.kind === "bank" ? "store" : "wallet"} size={22} />
            <strong>{data.payoutMethod.label}</strong>
            <Tag tone="success">Checked</Tag>
          </div>
          {data.payoutMethod.holderName && <p className={styles.muted}>{`In the name of ${data.payoutMethod.holderName}`}</p>}
          {data.payoutMethod.ifsc && <p className={styles.muted}>{`IFSC ${data.payoutMethod.ifsc}`}</p>}
          <div>
            <button type="button" className={styles.link} onClick={() => setChanging(true)}>
              Change
            </button>
          </div>
        </div>
      ) : (
        <MethodForm
          onCancel={data.payoutMethod ? () => setChanging(false) : undefined}
          onSaved={(payoutMethod) => {
            setData({ ...data, payoutMethod });
            setChanging(false);
          }}
        />
      )}

      <h2 className={styles.overline}>Payouts</h2>
      {data.payouts.length ? (
        <ul className={`${styles.card} ${styles.payouts}`}>
          {data.payouts.map((p) => (
            <li key={p.id}>
              <span className={styles.identity}>
                <strong>{money(p.amount)}</strong>
                <span className={styles.muted}>{`${p.to} · ${ago(p.paidAt ?? p.createdAt)}`}</span>
              </span>
              <Tag tone={PAYOUT_STATUS[p.status].tone}>{PAYOUT_STATUS[p.status].label}</Tag>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.muted}>No payouts yet.</p>
      )}
    </div>
  );
}
