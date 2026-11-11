"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/profile/Avatar";
import { useMe, useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { Button, Icon, Segmented, Skeleton, Tag, useToast, type TagTone } from "@/components/ui";
import { formError } from "@/lib/api/account";
import { approveCase, rejectCase, reviewQueue, type ReviewCase, type ReviewStatus } from "@/lib/api/kyc";
import { ago, exact } from "@/lib/time";
import styles from "./review.module.css";

const TABS: { value: ReviewStatus; label: string }[] = [
  { value: "submitted", label: "To review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "locked", label: "On hold" },
];

const STATUS_TAG: Record<ReviewCase["status"], [string, TagTone]> = {
  not_started: ["Not started", "neutral"],
  in_progress: ["In progress", "neutral"],
  submitted: ["To review", "warning"],
  approved: ["Approved", "success"],
  rejected: ["Rejected", "danger"],
  locked: ["On hold", "danger"],
};

const MATCH_COPY: Record<string, string> = {
  DIRECT_MATCH: "Exact",
  GOOD_PARTIAL_MATCH: "Good partial",
  MODERATE_PARTIAL_MATCH: "Moderate partial",
  POOR_PARTIAL_MATCH: "Poor partial",
  NO_MATCH: "No match",
};

const percent = (score: number | null) => (score === null ? "—" : `${Math.round(score * 100)}%`);

function Fact({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={styles.fact}>
      <dt>{label}</dt>
      <dd data-warn={warn || undefined}>{value}</dd>
    </div>
  );
}

function Detail({ c, onDecided }: { c: ReviewCase; onDecided: (c: ReviewCase, verb: string) => void }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  // One key per decision, so a retried click is not applied twice.
  const keys = useRef({ approve: crypto.randomUUID(), reject: crypto.randomUUID() });
  const { identity: id, business } = c;

  async function decide(kind: "approve" | "reject") {
    setBusy(kind);
    try {
      const done = kind === "approve" ? await approveCase(c.id, keys.current.approve) : await rejectCase(c.id, reason.trim(), keys.current.reject);
      onDecided(done, kind === "approve" ? "approved" : done.status === "locked" ? "put on hold" : "sent back");
    } catch (err) {
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={styles.detail}>
      <dl className={styles.facts}>
        <Fact label="Phone" value={c.user.phone} />
        <Fact label="Member since" value={new Date(c.user.memberSince).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} />
        {id && (
          <>
            <Fact label="Name on Aadhaar" value={id.aadhaarName ?? "—"} warn={!!id.aadhaarName && id.aadhaarName.toLowerCase() !== c.user.name.toLowerCase()} />
            <Fact label="Aadhaar" value={id.aadhaarLast4 ? `XXXX XXXX ${id.aadhaarLast4}` : "—"} />
            <Fact label="PAN" value={id.panMasked ?? "—"} />
            <Fact label="Name on PAN" value={id.panName ?? "—"} />
            <Fact label="Name match" value={id.nameMatch ? (MATCH_COPY[id.nameMatch] ?? id.nameMatch) : "—"} warn={id.nameMatch !== "DIRECT_MATCH"} />
            <Fact label="Liveness" value={percent(id.livenessScore)} warn={(id.livenessScore ?? 0) < 0.8} />
            <Fact label="Face match" value={percent(id.faceMatchScore)} warn={(id.faceMatchScore ?? 0) < 0.8} />
          </>
        )}
        {business && (
          <>
            <Fact label="Business" value={business.name} />
            <Fact
              label="Address"
              value={[business.address.line1, business.address.line2, business.address.city, business.address.state, business.address.pincode].filter(Boolean).join(", ")}
            />
            <Fact label="GSTIN" value={business.gstin ? `${business.gstin.number}${business.gstin.status ? ` (${business.gstin.status})` : ""}` : "Not given"} />
            {business.gstin?.legalName && <Fact label="GST legal name" value={business.gstin.legalName} />}
          </>
        )}
      </dl>

      {c.review && (
        <p className={styles.muted}>
          {c.review.decision === "approved" ? "Approved" : "Rejected"} {ago(c.review.at)}
          {c.review.reason ? `: ${c.review.reason}` : ""}
        </p>
      )}

      {c.status === "submitted" &&
        (rejecting ? (
          <div className={styles.reject}>
            <label className={styles.label} htmlFor={`reason-${c.id}`}>
              What should they fix? They will see this.
            </label>
            <textarea
              id={`reason-${c.id}`}
              className={styles.textarea}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={300}
              rows={3}
              placeholder="For example: your selfie is blurry. Retake it in good light."
              autoFocus
            />
            <div className={styles.actions}>
              <span className={styles.count}>{reason.length}/300</span>
              <Button variant="ghost" onClick={() => setRejecting(false)}>
                Cancel
              </Button>
              <Button variant="danger" disabled={reason.trim().length < 5} loading={busy === "reject"} onClick={() => decide("reject")}>
                Send back{c.rejections >= 2 ? " and put on hold" : ""}
              </Button>
            </div>
          </div>
        ) : (
          <div className={styles.actions}>
            {c.rejections > 0 && <span className={styles.muted}>Rejected {c.rejections === 1 ? "once" : `${c.rejections} times`} before</span>}
            <Button variant="secondary" onClick={() => setRejecting(true)} disabled={!!busy}>
              Reject
            </Button>
            <Button onClick={() => decide("approve")} loading={busy === "approve"} icon={<Icon name="check" size={18} />}>
              Approve
            </Button>
          </div>
        ))}
    </div>
  );
}

export function ReviewScreen() {
  const me = useMe();
  const [status, setStatus] = useState<ReviewStatus>("submitted");

  const allowed = me && (me.roles.admin || me.roles.ruxstarStaff);
  if (me === null || (me && !allowed)) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Verification review</h1>
        <p className={styles.muted}>This page is for the Ruxstar team.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <h1 className={styles.title}>Verification review</h1>
        <Segmented label="Show" options={TABS} value={status} onChange={setStatus} />
      </div>
      {me ? <Queue key={status} status={status} /> : <QueueSkeleton />}
    </div>
  );
}

function QueueSkeleton() {
  return (
    <div className={styles.list} aria-busy>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} height={72} radius={14} />
      ))}
    </div>
  );
}

function Queue({ status }: { status: ReviewStatus }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback((cursor?: string) => reviewQueue(status, cursor), [status]);
  const { items, setItems, loading, loadingMore, hasMore, error, more, reload } = usePages(load);
  const sentinel = useNearEnd(more, hasMore && !error);

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  return (
    <>
      {loading ? (
        <QueueSkeleton />
      ) : error && items.length === 0 ? (
        <div className={styles.failed} role="alert">
          <p>{formError(error).message}</p>
          <Button variant="secondary" onClick={reload}>
            Try again
          </Button>
        </div>
      ) : items.length === 0 ? (
        <p className={styles.empty}>{status === "submitted" ? "Nothing waiting. Nice." : "No cases here."}</p>
      ) : (
        <ul className={styles.list}>
          {items.map((c) => {
            const [label, tone] = STATUS_TAG[c.status];
            const expanded = open === c.id;
            return (
              <li key={c.id} className={styles.item} data-open={expanded || undefined}>
                <button type="button" className={styles.row} aria-expanded={expanded} onClick={() => setOpen(expanded ? null : c.id)}>
                  <Avatar name={c.user.name} url={c.user.avatarUrl} size={44} />
                  <span className={styles.who}>
                    <span className={styles.name}>{c.user.name || "No name"}</span>
                    <span className={styles.muted}>
                      @{c.user.username} · {c.track === "base" ? "Identity" : "Vendor"}
                    </span>
                  </span>
                  <Tag tone={tone}>{label}</Tag>
                  {c.submittedAt && (
                    <time className={styles.time} dateTime={c.submittedAt} title={exact(c.submittedAt)}>
                      {ago(c.submittedAt)}
                    </time>
                  )}
                  <Icon name="chevron-down" size={20} className={styles.chevron} />
                </button>
                {expanded && (
                  <Detail
                    c={c}
                    onDecided={(done, verb) => {
                      toast(`${done.user.name || "Case"} ${verb}.`, "success");
                      setOpen(null);
                      setItems((list) => (status === "submitted" ? list.filter((x) => x.id !== done.id) : list.map((x) => (x.id === done.id ? done : x))));
                    }}
                  />
                )}
              </li>
            );
          })}
          {hasMore && <li ref={sentinel} aria-hidden />}
          {loadingMore && <Skeleton height={72} radius={14} />}
        </ul>
      )}
    </>
  );
}
