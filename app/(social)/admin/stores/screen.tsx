"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Needs } from "@/components/admin/AdminFrame";
import { Failed, MoreFailed, Rows, styles } from "@/components/admin/parts";
import { Avatar } from "@/components/profile/Avatar";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { Icon, Input, Skeleton, Tag } from "@/components/ui";
import { consoleStores, type ConsoleStore } from "@/lib/api/store";
import { plural, storeTypeLabel } from "@/lib/store";

type Filter = { q?: string; city?: string };

function Results({ filter }: { filter: Filter }) {
  const onSignedOut = useOnSignedOut();
  const load = useCallback((cursor?: string) => consoleStores(filter, cursor), [filter]);
  const { items, loading, loadingMore, hasMore, error, moreFailed, more, reload } = usePages<ConsoleStore>(load);
  const sentinel = useNearEnd(more, hasMore && !error);

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  if (loading) return <Rows count={5} />;
  if (error && items.length === 0) return <Failed error={error} onRetry={reload} />;
  if (items.length === 0) {
    return <p className={styles.empty}>{filter.q || filter.city ? "No shop matches that. Try another word or city." : "Local shops show up here once someone adds one."}</p>;
  }

  return (
    <ul className={styles.list}>
      {items.map((s) => (
        <li key={s.id} className={styles.item}>
          <Link href={`/admin/stores/${s.id}`} className={styles.row}>
            <Avatar name={s.name} url={s.photoUrl} size={44} />
            <span className={styles.whoRow}>
              <span className={styles.name}>{s.name}</span>
              <span className={`${styles.muted} ${styles.line}`}>
                {`${storeTypeLabel(s.type)} · ${s.city} · ${plural(s.products, "product")} · ${plural(s.orders, "order")}`}
              </span>
            </span>
            <span className={styles.tags}>
              {s.suspended && <Tag tone="danger">Suspended</Tag>}
              {s.status === "draft" && <Tag>Draft</Tag>}
              {!s.open && !s.suspended && <Tag>Closed</Tag>}
            </span>
            <Icon name="chevron-right" size={20} className={styles.chevron} />
          </Link>
        </li>
      ))}
      {hasMore && <li ref={sentinel} aria-hidden />}
      {moreFailed && <MoreFailed onRetry={more} />}
      {loadingMore && <Skeleton height={72} radius={14} />}
    </ul>
  );
}

/** Every local shop, newest first, searchable by name and city. Shops go live without review; suspending one is on its business page. */
export function StoresScreen() {
  const [text, setText] = useState("");
  const [cityText, setCityText] = useState("");
  const [filter, setFilter] = useState<Filter>({});

  useEffect(() => {
    const t = setTimeout(() => {
      const q = text.trim();
      const city = cityText.trim();
      setFilter({ ...(q ? { q } : {}), ...(city ? { city } : {}) });
    }, 300);
    return () => clearTimeout(t);
  }, [text, cityText]);

  return (
    <Needs need="businesses.view">
      <div className={styles.page}>
        <h1 className={styles.title}>Local shops</h1>
        <div className={styles.toolbar}>
          <Input label="Find a shop" placeholder="Shop name" type="search" value={text} onChange={(e) => setText(e.target.value)} maxLength={60} autoComplete="off" />
          <Input label="City" placeholder="Any city" value={cityText} onChange={(e) => setCityText(e.target.value)} maxLength={60} autoComplete="off" />
        </div>
        <Results key={`${filter.q ?? ""}:${filter.city ?? ""}`} filter={filter} />
      </div>
    </Needs>
  );
}
