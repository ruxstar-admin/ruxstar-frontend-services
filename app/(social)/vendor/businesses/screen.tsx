"use client";

import Link from "next/link";
import { useState } from "react";
import { ButtonLink, Icon, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { Cover, Failed, Loading, Toggle } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { formError } from "@/lib/api/account";
import { MODULE_LABEL } from "@/lib/api/shops";
import { canOpen, myBusinesses, setBusinessOpen, statusOf, type Business } from "@/lib/api/vendor";
import styles from "@/components/vendor/vendor.module.css";

/** Matches the API's cap. */
const MAX_BUSINESSES = 10;

function subtitleOf(b: Business) {
  if (b.status === "draft") return "Finish setup";
  return [MODULE_LABEL[b.module], b.location?.city].filter(Boolean).join(" · ");
}

/** Every business as a card, each with its own Open switch, and Add business at the top. Same as the app. */
export function BusinessesScreen() {
  const onSignedOut = useOnSignedOut();
  const { data, error, reload, setData } = useLoad(myBusinesses);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [failure, setFailure] = useState<string | null>(null);

  if (error && !data) return <Failed error={error} onRetry={reload} />;
  if (!data) return <Loading />;

  const patch = (id: string, changes: Partial<Business>) => setData((list) => (list ?? []).map((b) => (b.id === id ? { ...b, ...changes } : b)));
  const mark = (id: string, on: boolean) =>
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const toggle = async (b: Business, open: boolean) => {
    setFailure(null);
    patch(b.id, { open });
    mark(b.id, true);
    try {
      patch(b.id, await setBusinessOpen(b.id, open));
    } catch (err) {
      patch(b.id, { open: !open });
      if (!onSignedOut(err)) setFailure(formError(err).message);
      reload();
    } finally {
      mark(b.id, false);
    }
  };

  const canAdd = data.length < MAX_BUSINESSES;

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <h1 className={styles.title}>Businesses</h1>
        {canAdd && data.length > 0 && (
          <ButtonLink href="/vendor/businesses/new" icon={<Icon name="plus" size={18} />}>
            Add business
          </ButtonLink>
        )}
      </div>
      {failure && (
        <p className={styles.error} role="alert">
          {failure}
        </p>
      )}
      {data.length ? (
        <ul className={styles.businessGrid}>
          {data.map((b) => {
            const status = statusOf(b);
            const switchable = canOpen(b);
            return (
              <li key={b.id} className={styles.businessCard}>
                <Link href={`/vendor/businesses/${b.id}`} aria-label={`${b.name}, ${status.label}`}>
                  <span className={styles.businessCover}>
                    <Cover business={b} />
                    <span className={styles.businessBadge}>
                      <Tag tone={status.tone}>{status.label}</Tag>
                    </span>
                  </span>
                  <span className={styles.businessBody}>
                    <span className={styles.businessName}>{b.name}</span>
                    <span className={styles.rowLine}>{subtitleOf(b)}</span>
                  </span>
                </Link>
                {switchable && (
                  <div className={styles.businessToggle}>
                    <span data-open={b.open || undefined}>{b.open ? "Open" : "Closed"}</span>
                    <Toggle checked={b.open} disabled={busy.has(b.id)} label={`${b.name} open`} onChange={(on) => void toggle(b, on)} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty title="Open your first business">
          <p>Each business runs in one category: print on demand, events, coaching or stays. You can have several.</p>
          <ButtonLink href="/vendor/businesses/new" icon={<Icon name="plus" size={18} />}>
            Add business
          </ButtonLink>
        </Empty>
      )}
      {!canAdd && <p className={styles.faint}>{`You have the most businesses one vendor can run (${MAX_BUSINESSES}).`}</p>}
    </div>
  );
}
