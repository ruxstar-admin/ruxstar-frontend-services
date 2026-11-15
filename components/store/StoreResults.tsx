"use client";

import { useEffect, useState } from "react";
import { Button, Icon } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { ShopCardSkeleton } from "@/components/shop/ShopCard";
import { formError } from "@/lib/api/account";
import { listStores, type StoreFilters } from "@/lib/api/store";
import { STORE_TYPE_LABEL } from "@/lib/store";
import { StoreCard } from "./cards";
import social from "@/components/social/social.module.css";
import styles from "@/components/shop/shop.module.css";

const DEBOUNCE_MS = 300;
const TYPES = Object.entries(STORE_TYPE_LABEL);

function Cards({ filters }: { filters: StoreFilters }) {
  const onSignedOut = useOnSignedOut();
  const { items, loading, loadingMore, hasMore, error, more, reload } = usePages((cursor) => listStores(filters, cursor));
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
    const searching = Boolean(filters.q || filters.type || filters.city);
    return (
      <Empty title={searching ? "No shops match" : "No shops yet"}>
        <p>{searching ? "Try another kind of shop, city or name." : "Local shops on Ruxstar show up here as soon as they open."}</p>
      </Empty>
    );
  }
  return (
    <>
      <ul className={styles.grid}>
        {items.map((store, i) => (
          <li key={store.id}>
            <StoreCard store={store} index={i} eager={i < 3} />
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

/** Local shops for Discover: filter by kind and city; the search box matches shop names. Same as the app. */
export default function StoreResults({ q }: { q: string }) {
  const [type, setType] = useState<string | null>(null);
  const [cityText, setCityText] = useState("");
  const [city, setCity] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setCity(cityText.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [cityText]);

  const filters: StoreFilters = { ...(q ? { q: q.slice(0, 60) } : {}), ...(type ? { type } : {}), ...(city.length >= 2 ? { city: city.slice(0, 60) } : {}) };
  return (
    <>
      <div className={styles.chips} role="group" aria-label="Kind of shop">
        <button type="button" className={styles.subChip} aria-pressed={type === null} onClick={() => setType(null)}>
          All shops
        </button>
        {TYPES.map(([key, label]) => (
          <button key={key} type="button" className={styles.subChip} aria-pressed={type === key} onClick={() => setType(key)}>
            {label}
          </button>
        ))}
      </div>
      <label className={social.searchBox}>
        <Icon name="map-pin" size={20} />
        <input
          className={social.searchInput}
          type="search"
          value={cityText}
          onChange={(e) => setCityText(e.target.value)}
          placeholder="Any city"
          aria-label="City"
          autoComplete="address-level2"
          maxLength={60}
        />
      </label>
      <Cards key={`${filters.q ?? ""}|${type ?? ""}|${filters.city ?? ""}`} filters={filters} />
    </>
  );
}
