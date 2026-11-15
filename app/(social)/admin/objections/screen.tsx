"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Needs, useCan } from "@/components/admin/AdminFrame";
import { Failed, MoreFailed, Rows, styles } from "@/components/admin/parts";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { Button, Segmented, Skeleton, Tag, useToast } from "@/components/ui";
import { formError } from "@/lib/api/account";
import { keepIdempotencyKey, newIdempotencyKey } from "@/lib/api/client";
import { money } from "@/lib/api/shops";
import { consoleObjections, decideObjection, type ConsoleReservation, type ObjectionStatus } from "@/lib/api/stays";
import { bedsText, momentText, stayText } from "@/lib/stays";

type Decision = "release" | "refund";

const STATUSES: { value: ObjectionStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "released", label: "Paid to owner" },
  { value: "refunded", label: "Refunded" },
  { value: "withdrawn", label: "Taken back" },
];
const STATUS_TAG: Record<ObjectionStatus, { label: string; tone: "danger" | "success" | "neutral" }> = {
  open: { label: "Open", tone: "danger" },
  released: { label: "Paid to owner", tone: "neutral" },
  refunded: { label: "Refunded", tone: "success" },
  withdrawn: { label: "Taken back", tone: "neutral" },
};

function Decide({ item, onDone }: { item: ConsoleReservation; onDone: (next: ConsoleReservation) => void }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const id = useId();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const key = useRef(newIdempotencyKey());

  const decide = async () => {
    if (!decision) return;
    setBusy(true);
    try {
      const next = await decideObjection(item.id, { decision, note: note.trim() }, key.current);
      key.current = newIdempotencyKey();
      toast(decision === "release" ? "The owner is paid, and both sides have your note." : "The tenant is being refunded in full, and both sides have your note.", "success");
      onDone(next);
    } catch (err) {
      if (!keepIdempotencyKey(err)) key.current = newIdempotencyKey();
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setBusy(false);
    }
  };

  if (!decision) {
    return (
      <div className={styles.actions}>
        <Button variant="secondary" onClick={() => setDecision("release")}>
          Pay the owner
        </Button>
        <Button variant="danger" onClick={() => setDecision("refund")}>
          Refund the tenant
        </Button>
      </div>
    );
  }
  return (
    <div className={styles.reason}>
      <label className={styles.label} htmlFor={id}>
        {decision === "release"
          ? "Pay the owner their share now? The stay carries on. Both the tenant and the owner read your note."
          : `Refund ${money(item.price.total)} to the tenant and end the stay? The bed opens up again. Both the tenant and the owner read your note.`}
      </label>
      <textarea
        id={id}
        className={styles.textarea}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        rows={3}
        placeholder={decision === "release" ? "For example: the owner sent photos of the tenant’s room in use." : "For example: the room wasn’t ready on the move-in day."}
        autoFocus
      />
      <div className={styles.actions}>
        <span className={styles.count}>{note.length}/500</span>
        <Button variant="ghost" onClick={() => setDecision(null)} disabled={busy}>
          Cancel
        </Button>
        <Button variant={decision === "refund" ? "danger" : "primary"} disabled={note.trim().length < 5} loading={busy} onClick={() => void decide()}>
          {decision === "release" ? "Pay the owner" : "Refund the tenant"}
        </Button>
      </div>
    </div>
  );
}

function Results({ status }: { status: ObjectionStatus }) {
  const onSignedOut = useOnSignedOut();
  const canDecide = useCan("orders.manage");
  const load = useCallback((cursor?: string) => consoleObjections(status, cursor), [status]);
  const { items, setItems, loading, loadingMore, hasMore, error, moreFailed, more, reload } = usePages<ConsoleReservation>(load);
  const sentinel = useNearEnd(more, hasMore && !error);

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  if (loading) return <Rows count={4} height={120} />;
  if (error && items.length === 0) return <Failed error={error} onRetry={reload} />;
  if (items.length === 0) return <p className={styles.empty}>{status === "open" ? "No open objections. When a tenant says something’s wrong after moving in, it shows up here." : "None yet."}</p>;

  return (
    <ul className={styles.list}>
      {items.map((r) => {
        const o = r.objection;
        const tag = o ? STATUS_TAG[o.status] : null;
        return (
          <li key={r.id} className={styles.item}>
            <div className={styles.row}>
              <span className={styles.whoRow}>
                <span className={styles.name}>{`${r.tenant.name} · ${r.property.name}`}</span>
                <span className={`${styles.muted} ${styles.line}`}>{`${bedsText(r)} · ${stayText(r)} · ${money(r.price.total)} · #${r.orderNo}`}</span>
                {r.movedInAt && <span className={`${styles.muted} ${styles.line}`}>{`Marked moved in ${momentText(r.movedInAt)}`}</span>}
              </span>
              {tag && (
                <span className={styles.tags}>
                  <Tag tone={tag.tone}>{tag.label}</Tag>
                </span>
              )}
            </div>
            {o && (
              <p className={styles.text}>
                {`“${o.reason}” · ${momentText(o.at)}`}
                {o.note ? ` · Ruxstar: ${o.note}` : ""}
              </p>
            )}
            <div className={styles.actions}>
              <Link className={styles.muted} href={`/admin/properties/${r.property.id}`}>
                Open the property
              </Link>
              <Link className={styles.muted} href={`/admin/users/${r.tenant.id}`}>
                Open the tenant
              </Link>
            </div>
            {canDecide && o?.status === "open" && <Decide item={r} onDone={(next) => setItems((all) => all.filter((x) => x.id !== next.id))} />}
          </li>
        );
      })}
      {hasMore && <li ref={sentinel} aria-hidden />}
      {moreFailed && <MoreFailed onRetry={more} />}
      {loadingMore && <Skeleton height={120} radius={14} />}
    </ul>
  );
}

/** Tenants who said something was wrong after the owner marked them moved in: pay the owner, or refund the tenant and end the stay. */
export function ObjectionsScreen() {
  const [status, setStatus] = useState<ObjectionStatus>("open");
  return (
    <Needs need="orders.view">
      <div className={styles.page}>
        <h1 className={styles.title}>Tenant objections</h1>
        <p className={styles.muted}>The owner isn’t paid while an objection is open. Read both sides, then decide; the tenant and the owner both get your note.</p>
        <Segmented label="Status" options={STATUSES} value={status} onChange={setStatus} />
        <Results key={status} status={status} />
      </div>
    </Needs>
  );
}
