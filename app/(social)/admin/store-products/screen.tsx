"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Needs } from "@/components/admin/AdminFrame";
import { Failed, MoreFailed, Rows, styles } from "@/components/admin/parts";
import { Avatar } from "@/components/profile/Avatar";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { ButtonLink, Icon, Input, Segmented, Skeleton, Tag } from "@/components/ui";
import { money } from "@/lib/api/shops";
import { consoleProducts, type ConsoleProduct, type ProductStatus } from "@/lib/api/store";
import { plural, PRODUCT_STATUS } from "@/lib/store";

type Status = ProductStatus | "all";
type Filter = { status?: ProductStatus; q?: string; shop?: string };

const STATUSES: { value: Status; label: string }[] = [
  { value: "all", label: "All" },
  { value: "live", label: "On sale" },
  { value: "hidden", label: "Off sale" },
  { value: "removed", label: "Taken down" },
];

function Results({ filter }: { filter: Filter }) {
  const onSignedOut = useOnSignedOut();
  const load = useCallback((cursor?: string) => consoleProducts(filter, cursor), [filter]);
  const { items, loading, loadingMore, hasMore, error, moreFailed, more, reload } = usePages<ConsoleProduct>(load);
  const sentinel = useNearEnd(more, hasMore && !error);

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  if (loading) return <Rows count={5} />;
  if (error && items.length === 0) return <Failed error={error} onRetry={reload} />;
  if (items.length === 0) {
    return <p className={styles.empty}>{filter.q ? "No product matches that. Try another word from its title." : "Products local shops add show up here."}</p>;
  }

  return (
    <ul className={styles.list}>
      {items.map((p) => {
        const status = PRODUCT_STATUS[p.status];
        const stock = p.variants.reduce((s, v) => s + v.stock, 0);
        return (
          <li key={p.id} className={styles.item}>
            <Link href={`/admin/store-products/${p.id}`} className={styles.row}>
              <Avatar name={p.title} url={p.photo?.url ?? null} size={44} />
              <span className={styles.whoRow}>
                <span className={styles.name}>{p.title}</span>
                <span className={`${styles.muted} ${styles.line}`}>
                  {`${p.business.name} · ${p.city} · from ${money(p.priceFrom)} · ${plural(p.variants.length, "variant")} · ${stock} in stock`}
                </span>
              </span>
              <span className={styles.tags}>
                <Tag tone={status.tone}>{status.label}</Tag>
              </span>
              <Icon name="chevron-right" size={20} className={styles.chevron} />
            </Link>
          </li>
        );
      })}
      {hasMore && <li ref={sentinel} aria-hidden />}
      {moreFailed && <MoreFailed onRetry={more} />}
      {loadingMore && <Skeleton height={72} radius={14} />}
    </ul>
  );
}

/** Every local shop product, newest first, searchable by title and filtered by status; one shop's when opened from it. They go live without review. */
export function StoreProductsScreen({ shop }: { shop?: string }) {
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status>("all");

  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);

  const filter: Filter = { ...(q ? { q } : {}), ...(status === "all" ? {} : { status }), ...(shop ? { shop } : {}) };

  return (
    <Needs need="businesses.view">
      <div className={styles.page}>
        <h1 className={styles.title}>Shop products</h1>
        {shop && (
          <div className={styles.actions}>
            <ButtonLink href={`/admin/stores/${shop}`} variant="ghost" icon={<Icon name="arrow-left" size={18} />}>
              Back to the shop
            </ButtonLink>
            <ButtonLink href="/admin/store-products" variant="ghost">
              Every shop’s products
            </ButtonLink>
          </div>
        )}
        <div className={styles.toolbar}>
          <Input label="Find a product" placeholder="Product title" type="search" value={text} onChange={(e) => setText(e.target.value)} maxLength={60} autoComplete="off" />
          <Segmented label="Status" options={STATUSES} value={status} onChange={setStatus} />
        </div>
        <Results key={`${status}:${q}:${shop ?? ""}`} filter={filter} />
      </div>
    </Needs>
  );
}
