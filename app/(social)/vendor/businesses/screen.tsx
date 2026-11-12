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
  if (b.status === "draft") return "Draft · Finish setup";
  if (canOpen(b)) return b.open ? "Open · Taking orders" : "Closed";
  return `${MODULE_LABEL[b.module]} · ${statusOf(b).label}`;
}

/** Every business, each with its own Open switch, and Add a business. Same as the app. */
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

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Businesses</h1>
      {data.length ? (
        <ul className={styles.businesses}>
          {data.map((b) => {
            const status = statusOf(b);
            const switchable = canOpen(b);
            return (
              <li key={b.id} className={styles.business}>
                <Link href={`/vendor/businesses/${b.id}`}>
                  <Cover business={b} />
                  <span className={styles.rowText}>
                    <span className={styles.rowTitle}>{b.name}</span>
                    <span className={styles.rowLine} data-open={(switchable && b.open) || undefined}>
                      {subtitleOf(b)}
                    </span>
                  </span>
                </Link>
                {switchable ? (
                  <Toggle checked={b.open} disabled={busy.has(b.id)} label={`${b.name} open`} onChange={(on) => void toggle(b, on)} />
                ) : (
                  <Tag tone={status.tone}>{status.label}</Tag>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty title="Open your first business">
          <p>Each business runs in one category: print on demand, events, coaching or stays. You can have several.</p>
        </Empty>
      )}
      {failure && (
        <p className={styles.error} role="alert">
          {failure}
        </p>
      )}
      {data.length < MAX_BUSINESSES ? (
        <div>
          <ButtonLink href="/vendor/businesses/new" icon={<Icon name="plus" size={18} />}>
            Add a business
          </ButtonLink>
        </div>
      ) : (
        <p className={styles.faint}>{`You have the most businesses one vendor can run (${MAX_BUSINESSES}).`}</p>
      )}
    </div>
  );
}
