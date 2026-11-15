"use client";

import { useEffect, useRef, useState } from "react";
import { Button, ButtonLink, Icon, Input, Segmented, Tag, useToast, type IconName, type TagTone } from "@/components/ui";
import { useOnSignedOut } from "@/components/social/session";
import { usePages } from "@/components/social/use-pages";
import { SkeletonRows } from "@/app/(social)/notifications/screen";
import { Failed, Loading } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { formError } from "@/lib/api/account";
import { ApiError, keepIdempotencyKey, newIdempotencyKey } from "@/lib/api/client";
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
import { INVOICE_KIND, invoiceHref } from "@/lib/invoices";
import { ago, exact } from "@/lib/time";
import styles from "@/components/vendor/vendor.module.css";

const KINDS = [
  { value: "bank", label: "Bank account" },
  { value: "upi", label: "UPI ID" },
] as const;
const ACCOUNT = /^[0-9]{9,18}$/;
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const VPA = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,64}$/;

const TABS = [
  { value: "statement", label: "Statement" },
  { value: "payouts", label: "Payouts" },
] as const;

type Payout = Payments["payouts"][number];

const PAYOUT_STATUS: Record<Payout["status"], { label: string; tone: TagTone }> = {
  paid: { label: "Paid", tone: "success" },
  pending: { label: "On the way", tone: "warning" },
  failed: { label: "Failed", tone: "danger" },
};

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
          <Button variant="secondary" disabled={saving} onClick={onCancel}>
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
    ? "Add where you get paid to withdraw."
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
      if (!keepIdempotencyKey(err)) {
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
            <Button variant="secondary" disabled={sending} onClick={() => setAsking(false)}>
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

/** How each kind of statement line looks, and what it means for the vendor. Same as the app. */
const LINES = {
  paid: { icon: "wallet", title: "Order payment", note: "Your share of this order. You can withdraw it 48 hours after delivery." },
  available: { icon: "check", title: "Ready to withdraw", note: "The hold after delivery ended, so this can be withdrawn." },
  refund: { icon: "undo", title: "Refund to customer", note: "Sent back to the customer out of your share." },
  delivery: { icon: "bicycle", title: "Delivery partner pay", note: "Paid to the Ruxstar partner who delivered it, out of your share." },
  withdrawal: { icon: "send", title: "Withdrawal", note: "Sent from your balance to your account." },
  returned: { icon: "refresh", title: "Withdrawal returned", note: "The bank couldn't complete the withdrawal, so it's back in your balance." },
} as const satisfies Record<StatementLine["kind"], { icon: IconName; title: string; note: string }>;

const REFUNDED_BY: Record<NonNullable<StatementLine["refund"]>["by"], string> = {
  vendor: "You",
  customer: "The customer, before you accepted",
  staff: "Ruxstar, after a reported problem",
  system: "Automatically",
};

/** "+₹3,240", "−₹500"; moving to available isn't new money, so it has no sign. */
const signed = (line: StatementLine) =>
  `${line.kind === "available" ? "" : line.amount > 0 ? "+" : line.amount < 0 ? "−" : ""}${money(Math.abs(line.amount))}`;

function Fact({ label, value, copy }: { label: string; value: string; copy?: string }) {
  const toast = useToast();
  const copyIt = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast(`${copy} copied`, "neutral");
    } catch {
      toast("Couldn't copy. Select it and copy it yourself.", "danger");
    }
  };
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        <span>{value}</span>
        {copy && (
          <Button variant="ghost" aria-label={`Copy ${copy}`} onClick={() => void copyIt()}>
            <Icon name="copy" size={16} />
          </Button>
        )}
      </dd>
    </div>
  );
}

function LineDetails({ line }: { line: StatementLine }) {
  const { order, refund, payout } = line;
  return (
    <div className={styles.payDetails}>
      <p className={styles.faint}>{LINES[line.kind].note}</p>
      <dl className={styles.payFacts}>
        <Fact label="When" value={exact(line.at)} />
        {order && (
          <>
            {order.business && <Fact label="Business" value={order.business.name} />}
            <Fact label={line.kind === "refund" ? "Refunded to" : "Paid by"} value={order.customer} />
            <Fact label="Order" value={`#${order.orderNo} · ${order.label} · ${money(order.total)} paid`} />
            {order.paymentId && <Fact label="Payment ID" value={order.paymentId} copy="Payment ID" />}
            {order.paidAt && line.kind !== "paid" && <Fact label="Paid on" value={exact(order.paidAt)} />}
          </>
        )}
        {refund && (
          <>
            <Fact label="Refund ID" value={refund.id} copy="Refund ID" />
            <Fact label="Refunded by" value={REFUNDED_BY[refund.by]} />
            {refund.reason && <Fact label="Reason" value={refund.reason} />}
          </>
        )}
        {payout && (
          <>
            <Fact label="To" value={payout.to} />
            {line.kind === "withdrawal" && <Fact label="Reached your account" value={`${money(Math.abs(line.amount) - payout.fee)} after a ${money(payout.fee)} fee`} />}
            <Fact label="Status" value={PAYOUT_STATUS[payout.status].label} />
            {payout.utr && <Fact label="Bank reference" value={payout.utr} copy="Bank reference" />}
          </>
        )}
      </dl>
      {(order || line.invoice) && (
        <div className={styles.actions}>
          {order && (
            <ButtonLink href={`/vendor/orders/${order.id}`} variant="secondary">
              View order
            </ButtonLink>
          )}
          {line.invoice && (
            <ButtonLink href={invoiceHref("vendor", line.invoice.id)} variant="secondary" icon={<Icon name="receipt" size={16} />}>
              {`${INVOICE_KIND[line.invoice.kind]} ${line.invoice.number}`}
            </ButtonLink>
          )}
        </div>
      )}
    </div>
  );
}

/** Every change to the vendor's earnings, a page at a time. Each line opens its payment details. */
function Statement() {
  const onSignedOut = useOnSignedOut();
  const { items, loading, loadingMore, hasMore, error, more, reload } = usePages(vendorStatement);
  const [open, setOpen] = useState<string | null>(null);

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
      <ul className={styles.payRows}>
        {items.map((line) => {
          const look = LINES[line.kind];
          const where = line.order ? [`#${line.order.orderNo}`, line.order.label, line.order.business?.name] : [line.payout?.to];
          return (
            <li key={line.id}>
              <button type="button" className={styles.payRow} aria-expanded={open === line.id} onClick={() => setOpen(open === line.id ? null : line.id)}>
                <span className={styles.payIcon} data-kind={line.kind}>
                  <Icon name={look.icon} size={18} />
                </span>
                <span className={styles.identity}>
                  <strong>{look.title}</strong>
                  <span className={styles.muted}>{[...where, ago(line.at)].filter(Boolean).join(" · ")}</span>
                </span>
                <span className={styles.payAmount} data-kind={line.kind}>
                  {signed(line)}
                </span>
                <Icon name={open === line.id ? "chevron-down" : "chevron-right"} size={16} />
              </button>
              {open === line.id && <LineDetails line={line} />}
            </li>
          );
        })}
      </ul>
      {hasMore && (
        <div>
          <Button variant="secondary" loading={loadingMore} onClick={more}>
            Show more
          </Button>
        </div>
      )}
    </>
  );
}

function Payouts({ payouts }: { payouts: Payout[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!payouts.length) return <p className={styles.muted}>No payouts yet. Withdrawals you make show here.</p>;
  return (
    <ul className={styles.payRows}>
      {payouts.map((p) => {
        const status = PAYOUT_STATUS[p.status];
        return (
          <li key={p.id}>
            <button type="button" className={styles.payRow} aria-expanded={open === p.id} onClick={() => setOpen(open === p.id ? null : p.id)}>
              <span className={styles.payIcon} data-kind="withdrawal">
                <Icon name="send" size={18} />
              </span>
              <span className={styles.identity}>
                <strong>{money(p.amount)}</strong>
                <span className={styles.muted}>{`${p.to} · ${ago(p.paidAt ?? p.createdAt)}`}</span>
              </span>
              <Tag tone={status.tone}>{status.label}</Tag>
              <Icon name={open === p.id ? "chevron-down" : "chevron-right"} size={16} />
            </button>
            {open === p.id && (
              <div className={styles.payDetails}>
                {p.status === "failed" && p.failure && (
                  <p className={styles.error} role="alert">
                    {`${p.failure} The money is back in your balance.`}
                  </p>
                )}
                <dl className={styles.payFacts}>
                  <Fact label="To" value={p.to} />
                  <Fact label="Reached your account" value={`${money(p.amount - p.fee)} after a ${money(p.fee)} fee`} />
                  <Fact label="Asked for" value={exact(p.createdAt)} />
                  {p.paidAt && <Fact label="Paid" value={exact(p.paidAt)} />}
                  {p.utr && <Fact label="Bank reference" value={p.utr} copy="Bank reference" />}
                  <Fact label="Payout ID" value={p.id} copy="Payout ID" />
                </dl>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** What can be withdrawn, what's on hold and what was paid out; where the vendor is paid; the statement and payouts. Same as the app. */
export function PaymentsScreen() {
  const { data, error, reload, setData } = useLoad(vendorPayments);
  const [changing, setChanging] = useState(false);
  const [showPending, setShowPending] = useState(false);
  const [tab, setTab] = useState<(typeof TABS)[number]["value"]>("statement");
  const [statementVersion, setStatementVersion] = useState(0);
  const refresh = () => {
    reload();
    setStatementVersion((v) => v + 1);
  };

  if (error && !data) return <Failed error={error} onRetry={reload} />;
  if (!data) return <Loading />;

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <h1 className={styles.title}>Payments</h1>
        <ButtonLink href="/vendor/invoices" variant="secondary" icon={<Icon name="receipt" size={18} />}>
          Invoices
        </ButtonLink>
      </div>
      <div className={styles.balance}>
        <div data-tone="success">
          <span className={styles.balanceLabel}>
            <Icon name="wallet" size={16} />
            Available to withdraw
          </span>
          <strong className={styles.balanceBig}>{money(data.balance.available)}</strong>
          <Withdraw data={data} onDone={refresh} />
        </div>
        <button type="button" data-tone="warning" aria-expanded={showPending} onClick={() => setShowPending((v) => !v)}>
          <span className={styles.balanceLabel}>
            <Icon name="clock" size={16} />
            <span>Pending</span>
            <Icon name={showPending ? "chevron-down" : "chevron-right"} size={14} />
          </span>
          <strong className={styles.balanceValue}>{money(data.balance.pending)}</strong>
          <span className={styles.faint}>{data.upcoming.length ? `${data.upcoming.length} coming up` : "Nothing on hold"}</span>
        </button>
        <div data-tone="accent">
          <span className={styles.balanceLabel}>
            <Icon name="check" size={16} />
            Paid out
          </span>
          <strong className={styles.balanceValue}>{money(data.balance.paidOut)}</strong>
          <span className={styles.faint}>To your account</span>
        </div>
      </div>

      {showPending &&
        (data.upcoming.length ? (
          <>
            <p className={styles.faint}>Your share of each order becomes available 48 hours after delivery, or once Ruxstar settles a reported problem.</p>
            <ul className={styles.payRows}>
              {data.upcoming.map((u) => (
                <li key={u.orderId}>
                  <div className={styles.payRow}>
                    <span className={styles.payIcon} data-kind={u.held ? "paid" : "delivery"}>
                      <Icon name={u.held ? "alert" : "clock"} size={18} />
                    </span>
                    <span className={styles.identity}>
                      <strong>{`Order #${u.orderNo}`}</strong>
                      <span className={styles.muted}>{u.held ? "Held for a reported problem" : `Available ${exact(u.availableAt)}`}</span>
                    </span>
                    <span className={styles.payAmount}>{money(u.amount)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className={styles.muted}>Nothing on hold. Your share of an order shows here once it&apos;s delivered, until you can withdraw it.</p>
        ))}

      {data.payoutMethod && !changing ? (
        <div className={`${styles.card} ${styles.methodRow}`}>
          <span className={styles.payIcon}>
            <Icon name={data.payoutMethod.kind === "bank" ? "store" : "phone"} size={18} />
          </span>
          <span className={styles.identity}>
            <strong>{data.payoutMethod.label}</strong>
            <span className={styles.muted}>{[data.payoutMethod.holderName ?? "Where you get paid", data.payoutMethod.ifsc].filter(Boolean).join(" · ")}</span>
          </span>
          <Tag tone="success">Checked</Tag>
          <Button variant="secondary" onClick={() => setChanging(true)}>
            Change
          </Button>
        </div>
      ) : (
        <>
          <h2 className={styles.overline}>Where you get paid</h2>
          <MethodForm
            onCancel={data.payoutMethod ? () => setChanging(false) : undefined}
            onSaved={(payoutMethod) => {
              setData({ ...data, payoutMethod });
              setChanging(false);
            }}
          />
        </>
      )}

      <Segmented label="Show" options={TABS} value={tab} onChange={setTab} />
      {tab === "statement" ? <Statement key={statementVersion} /> : <Payouts payouts={data.payouts} />}
    </div>
  );
}
