"use client";

import { useEffect, useState } from "react";
import { Button, Icon } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { ShopCard, ShopCardSkeleton } from "@/components/shop/ShopCard";
import { formError } from "@/lib/api/account";
import { podProducts, shops, type PodProduct, type ShopFilters } from "@/lib/api/shops";
import social from "@/components/social/social.module.css";
import styles from "@/components/shop/shop.module.css";

const DEBOUNCE_MS = 300;

function Results({ filters }: { filters: ShopFilters }) {
  const onSignedOut = useOnSignedOut();
  const { items, loading, loadingMore, hasMore, error, more, reload } = usePages((cursor) => shops(filters, cursor));
  const sentinel = useNearEnd(more, hasMore && !error);

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  if (loading) {
    return (
      <div className={styles.grid} aria-busy>
        <ShopCardSkeleton />
        <ShopCardSkeleton />
        <ShopCardSkeleton />
      </div>
    );
  }
  if (error && items.length === 0) {
    return (
      <div className={social.failed} role="alert">
        <p>{formError(error).message}</p>
        <Button variant="secondary" onClick={reload}>
          Try again
        </Button>
      </div>
    );
  }
  if (items.length === 0) {
    const searching = Boolean(filters.q || filters.product);
    return (
      <Empty title={searching ? "No shops match" : "No print shops yet"}>
        <p>{searching ? "Try another product or name." : "Print shops on Ruxstar show up here as soon as they open."}</p>
      </Empty>
    );
  }

  return (
    <>
      <ul className={styles.grid}>
        {items.map((shop, i) => (
          <li key={shop.id}>
            <ShopCard shop={shop} index={i} eager={i < 3} />
          </li>
        ))}
      </ul>
      {hasMore && <div ref={sentinel} className={social.sentinel} aria-hidden />}
      {loadingMore && (
        <div className={styles.grid} aria-busy>
          <ShopCardSkeleton />
        </div>
      )}
    </>
  );
}

/** Print shops customers can order from, searchable and filtered by what they print. Same as the app's Discover tab. */
export function DiscoverScreen() {
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [product, setProduct] = useState<PodProduct | null>(null);
  const [chips, setChips] = useState<{ id: PodProduct; label: string }[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [text]);

  useEffect(() => {
    podProducts().then(setChips, () => undefined);
  }, []);

  const filters: ShopFilters = { ...(q ? { q } : {}), ...(product ? { product } : {}) };
  const chip = (id: PodProduct | null, label: string) => (
    <button key={id ?? "all"} type="button" className={styles.chip} aria-pressed={product === id} onClick={() => setProduct(id)}>
      {label}
    </button>
  );

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <h1 className={styles.title}>Discover</h1>
        <p className={styles.subtitle}>Print shops on Ruxstar</p>
      </div>
      <label className={social.searchBox}>
        <Icon name="search" size={20} />
        <input
          className={social.searchInput}
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search shops"
          aria-label="Search shops"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <div className={styles.chips} role="group" aria-label="What they print">
        {chip(null, "All")}
        {chips.map((c) => chip(c.id, c.label))}
      </div>
      <Results key={`${q}|${product ?? ""}`} filters={filters} />
    </div>
  );
}
