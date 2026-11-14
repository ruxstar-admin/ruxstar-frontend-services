"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Needs, useCan } from "@/components/admin/AdminFrame";
import { Failed, MoreFailed, Rows, styles } from "@/components/admin/parts";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { Button, Icon, Skeleton, Tag } from "@/components/ui";
import { auditLog, type AuditEntry, type AuditFilter } from "@/lib/api/admin";
import { ago, exact } from "@/lib/time";
import { MODULE_LABEL } from "../modules/labels";

const ACTIONS: Record<string, string> = {
  "kyc.approve": "Approved verification",
  "kyc.reject": "Sent verification back",
  "kyc.reopen": "Reopened verification",
  "report.keep": "Kept a reported post",
  "post.remove": "Removed a post",
  "user_report.dismiss": "Dismissed reports about someone",
  "user.suspend": "Put an account on hold",
  "user.unlock": "Unlocked an account",
  "user.sign_out": "Signed an account out everywhere",
  "user.password_reset": "Reset their password",
  "user.password_change": "Changed their password",
  "user.delete": "Deleted their account",
  "admin.grant": "Made an admin",
  "staff.grant": "Added to staff",
  "staff.update": "Changed staff access",
  "staff.revoke": "Removed from staff",
  "module_settings.update": "Changed module settings",
  "business.publish": "Published a business",
  "business.suspend": "Put a business on hold",
  "business.restore": "Lifted a hold on a business",
  "payout_method.set": "Set where they get paid",
  "pod_order.status": "Moved a print order on",
  "pod_order.problem": "Reported a problem with a print order",
  "pod_order.refund": "Refunded part of a print order",
  "pod_order.settle": "Settled a print order problem",
  "pod_order.release": "Released a shop's share early",
  "delivery.assign": "Sent an order for delivery",
  "delivery.cancel": "Cancelled a delivery",
  "payout.request": "Asked for a withdrawal",
  "payout.check": "Checked a withdrawal with Cashfree",
  "coupon.create": "Created a coupon",
  "coupon.update": "Changed a coupon",
  "review.create": "Reviewed an order",
  "review.update": "Changed a review",
  "review.delete": "Deleted a review",
  "review.reply": "Replied to a review",
  "review.reply_delete": "Took down a reply to a review",
  "review_report.keep": "Kept a reported review",
  "review.remove": "Removed a review",
  "post.create": "Posted",
  "business.update": "Changed a business's details",
  "business.catalog": "Changed a shop's products and prices",
  "business.photo_add": "Added a business photo",
  "business.photo_remove": "Removed a business photo",
  "business.open": "Opened a shop",
  "business.close": "Closed a shop",
  "team.invite": "Invited someone to a team",
  "team.update": "Changed a team member's access",
  "team.remove": "Removed someone from a team",
  "team.leave": "Left a team",
  "team.join": "Joined a team",
  "team.decline": "Turned down a team invite",
  "support.reply": "Replied to a help ticket",
  "support.note": "Added a note to a help ticket",
  "support.update": "Changed a help ticket",
  "support.settings": "Changed help reply-by times",
};

const AREA_LABEL: Record<string, string> = {
  account: "Accounts",
  kyc: "Verification",
  social: "Posts",
  ruxstar: "Staff",
  vendor: "Vendor",
  support: "Help desk",
  ...MODULE_LABEL,
};

const show = (value: unknown) => (value === undefined || value === null ? "—" : typeof value === "string" ? value : JSON.stringify(value));

function Entry({ e }: { e: AuditEntry }) {
  const [open, setOpen] = useState(false);
  const canSeePeople = useCan("users.view");
  const changes = Object.entries(e.diff);
  const who = e.actor.kind === "system" ? "Ruxstar" : (e.actor.name ?? "Someone");
  const target =
    e.target.type === "user" && canSeePeople ? (
      <Link href={`/admin/users/${e.target.id}`}>account {e.target.id.slice(-6)}</Link>
    ) : e.target.type === "post" ? (
      <Link href={`/p/${e.target.id}`}>post {e.target.id.slice(-6)}</Link>
    ) : (
      `${e.target.type.replace(/_/g, " ")} ${e.target.id.slice(-6)}`
    );

  return (
    <li className={styles.item} data-open={open || undefined}>
      <button type="button" className={styles.row} aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className={styles.whoRow}>
          <span className={styles.name}>{ACTIONS[e.action] ?? e.action}</span>
          <span className={`${styles.muted} ${styles.line}`}>
            {who}
            {e.actor.username ? ` (@${e.actor.username})` : ""} · {AREA_LABEL[e.module] ?? e.module}
          </span>
        </span>
        {e.actor.kind !== "user" && <Tag tone={e.actor.kind === "admin" ? "solid" : "neutral"}>{e.actor.kind === "admin" ? "Admin" : e.actor.kind === "staff" ? "Staff" : "System"}</Tag>}
        <time className={styles.time} dateTime={e.at} title={exact(e.at)}>
          {ago(e.at)}
        </time>
        <Icon name="chevron-down" size={20} className={styles.chevron} />
      </button>
      {open && (
        <div className={styles.detail}>
          <p className={styles.muted}>
            {exact(e.at)} · on {target}
            {e.ip ? ` · from ${e.ip}` : ""}
          </p>
          {changes.length > 0 ? (
            <dl className={styles.diff}>
              {changes.map(([field, c]) => (
                <div key={field}>
                  <dt>{field}: </dt>
                  <dd>
                    {show(c.from)} → {show(c.to)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className={styles.muted}>No fields changed.</p>
          )}
        </div>
      )}
    </li>
  );
}

function Log({ filter }: { filter: AuditFilter }) {
  const onSignedOut = useOnSignedOut();
  const load = useCallback((cursor?: string) => auditLog(filter, cursor), [filter]);
  const { items, loading, loadingMore, hasMore, error, moreFailed, more, reload } = usePages(load);
  const sentinel = useNearEnd(more, hasMore && !error);

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  if (loading) return <Rows count={6} />;
  if (error && items.length === 0) return <Failed error={error} onRetry={reload} />;
  if (items.length === 0) return <p className={styles.empty}>Nothing logged for this filter.</p>;

  return (
    <ul className={styles.list}>
      {items.map((e) => (
        <Entry key={e.id} e={e} />
      ))}
      {hasMore && <li ref={sentinel} aria-hidden />}
      {moreFailed && <MoreFailed onRetry={more} />}
      {loadingMore && <Skeleton height={72} radius={14} />}
    </ul>
  );
}

export function AuditScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const area = params.get("module") ?? "";
  const action = params.get("action") ?? "";
  const target = params.get("target") ?? "";
  const actor = params.get("actor") ?? "";

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  const filter: AuditFilter = {
    ...(area ? { module: area } : {}),
    ...(action ? { action } : {}),
    ...(target ? { target } : {}),
    ...(actor ? { actor } : {}),
  };

  return (
    <Needs need="audit.view">
      <div className={styles.page}>
        <div>
          <h1 className={styles.title}>Audit log</h1>
          <p className={styles.muted}>Every change made by the team, and account changes people make themselves. Newest first.</p>
        </div>
        <div className={styles.toolbar}>
          <select className={styles.select} aria-label="Area" value={area} onChange={(e) => setParam("module", e.target.value)}>
            <option value="">Every area</option>
            {Object.entries(AREA_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select className={styles.select} aria-label="Action" value={action} onChange={(e) => setParam("action", e.target.value)}>
            <option value="">Every action</option>
            {Object.entries(ACTIONS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {(target || actor) && (
          <div className={styles.tags}>
            {target && (
              <Button variant="secondary" onClick={() => setParam("target", "")} icon={<Icon name="close" size={16} />}>
                Only {target.slice(-6)}
              </Button>
            )}
            {actor && (
              <Button variant="secondary" onClick={() => setParam("actor", "")} icon={<Icon name="close" size={16} />}>
                By {actor.slice(-6)}
              </Button>
            )}
          </div>
        )}
        <Log key={`${area}|${action}|${target}|${actor}`} filter={filter} />
      </div>
    </Needs>
  );
}
