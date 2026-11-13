"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, Icon, Input, Segmented, Tag, type IconName } from "@/components/ui";
import { useOnSignedOut } from "@/components/social/session";
import { usePages } from "@/components/social/use-pages";
import { SkeletonRows } from "@/app/(social)/notifications/screen";
import { Failed, Loading } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { formError } from "@/lib/api/account";
import { ApiError, newIdempotencyKey } from "@/lib/api/client";
import { money } from "@/lib/api/shops";
import {
  digitsOnly,
  setPayoutMethod,
  vendorPayments,
  vendorStatement,
  withdraw,
  type Payments,
  type PayoutMethod,
  type StatementLine,
} from "@/lib/api/vendor";
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

/** Withdraws everything available once there is enough and no withdrawal is already on the way. Same as the app. */
function Withdraw({ data, onDone }: { data: Payments; onDone: () => void }) {
  const onSignedOut = useOnSignedOut();
  const [asking, setAsking] = useState(false);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const key = useRef(newIdempotencyKey());
  const { available } = data.balance;
  const { minimum, fee } = data.withdrawal;
  const method = data.payoutMethod;
  const blocked = !method
    ? "Add where you get paid below to withdraw."
    : data.payouts.some((p) => p.status === "pending")
      ? "A withdrawal is on the way. You can withdraw again once it arrives."
      : available < minimum
        ? `You can withdraw once ${money(minimum)} is available.`
        : null;

  const send = async () => {
    setSending(true);
    setFailure(null);
    try {
      await withdraw(key.current);
      key.current = newIdempotencyKey();
      setAsking(false);
      onDone();
    } catch (err) {
      if (onSignedOut(err)) return;
      setFailure(formError(err).message);
      // Unsure whether it reached Ruxstar: trying again with the same key can't withdraw twice.
      if (err instanceof ApiError && err.code !== "NETWORK") {
        key.current = newIdempotencyKey();
        setAsking(false);
        onDone();
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {blocked || !method ? (
        <p className={styles.faint}>{blocked}</p>
      ) : asking ? (
        <div className={styles.form}>
          <strong>{`Withdraw ${money(available)}?`}</strong>
          <p className={styles.muted}>{`${money(available - fee)} goes to ${method.label} after a ${money(fee)} fee. Banks usually take a few minutes.`}</p>
          <div className={styles.actions}>
            <Button loading={sending} onClick={send}>
              Withdraw
            </Button>
            <Button variant="ghost" disabled={sending} onClick={() => setAsking(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className={styles.form}>
          <div>
            <Button onClick={() => setAsking(true)}>{`Withdraw ${money(available)}`}</Button>
          </div>
          <p className={styles.faint}>{`${money(available - fee)} reaches ${method.label} after a ${money(fee)} fee.`}</p>
        </div>
      )}
      {failure && (
        <p className={styles.error} role="alert">
          {failure}
        </p>
      )}
    </>
  );
}

const LINES = {
  paid: { icon: "wallet", title: "paid", note: "Pending" },
  available: { icon: "check", title: "available", note: "Can be withdrawn" },
  refund: { icon: "undo", title: "refund", note: "Back to the customer" },
  withdrawal: { icon: "send", title: "Withdrawal", note: "To your account" },
  returned: { icon: "refresh", title: "Withdrawal returned", note: "The bank couldn't complete it" },
} as const satisfies Record<StatementLine["kind"], { icon: IconName; title: string; note: string }>;

/** Every change to the vendor's earnings, a page at a time. Order lines open their order. */
function Statement() {
  const onSignedOut = useOnSignedOut();
  const { items, loading, loadingMore, hasMore, error, more, reload } = usePages(vendorStatement);

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  if (loading) return <SkeletonRows count={2} />;
  if (error && items.length === 0) {
    return (
      <div className={styles.card}>
        <p className={styles.error} role="alert">
          {formError(error).message}
        </p>
        <div>
          <Button variant="secondary" onClick={reload}>
            Try again
          </Button>
        </div>
      </div>
    );
  }
  if (items.length === 0) return <p className={styles.muted}>Nothing yet. Your share of each paid order shows here.</p>;
  return (
    <>
      <ul className={`${styles.card} ${styles.payouts} ${styles.statement}`}>
        {items.map((line) => {
          const look = LINES[line.kind];
          const sign = line.kind === "available" ? "" : line.amount > 0 ? "+" : line.amount < 0 ? "−" : "";
          const amount = <strong>{`${sign}${money(Math.abs(line.amount))}`}</strong>;
          const { order } = line;
          return (
            <li key={line.id}>
              {order ? (
                <Link href={`/vendor/orders/${order.id}`} data-kind={line.kind}>
                  <Icon name={look.icon} size={20} />
                  <span className={styles.identity}>
                    <span>{`Order #${order.orderNo} ${look.title}`}</span>
                    <span className={styles.muted}>{[order.business?.name, look.note, ago(line.at)].filter(Boolean).join(" · ")}</span>
                  </span>
                  {amount}
                </Link>
              ) : (
                <div data-kind={line.kind}>
                  <Icon name={look.icon} size={20} />
                  <span className={styles.identity}>
                    <span>{look.title}</span>
                    <span className={styles.muted}>{[line.payout?.to ?? look.note, ago(line.at)].join(" · ")}</span>
                  </span>
                  {amount}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {hasMore && (
        <div>
          <button type="button" className={styles.link} disabled={loadingMore} onClick={more}>
            {loadingMore ? "Loading…" : "Show more"}
          </button>
        </div>
      )}
    </>
  );
}

/** Balance, where the vendor is paid, their earnings statement and payouts. Same as the app. */
export function PaymentsScreen() {
  const { data, error, reload, setData } = useLoad(vendorPayments);
  const [changing, setChanging] = useState(false);
  const [statementVersion, setStatementVersion] = useState(0);
  const refresh = () => {
    reload();
    setStatementVersion((v) => v + 1);
  };

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
        <Withdraw data={data} onDone={refresh} />
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
                <span className={styles.muted}>{[p.to, p.fee ? `${money(p.fee)} fee` : null, ago(p.paidAt ?? p.createdAt)].filter(Boolean).join(" · ")}</span>
                {p.status === "failed" && p.failure && <span className={styles.error}>{`${p.failure} The money is back in your balance.`}</span>}
              </span>
              <Tag tone={PAYOUT_STATUS[p.status].tone}>{PAYOUT_STATUS[p.status].label}</Tag>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.muted}>No payouts yet.</p>
      )}

      <h2 className={styles.overline}>Statement</h2>
      <Statement key={statementVersion} />
    </div>
  );
}
