"use client";

import { useEffect, useState } from "react";
import { Button, Icon } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { FilterRow, FilterSelect } from "@/components/shop/FilterSelect";
import { ShopCardSkeleton } from "@/components/shop/ShopCard";
import { formError } from "@/lib/api/account";
import { listGigs, type GigsQuery } from "@/lib/api/gigs";
import { GigCard } from "./GigCard";
import { useGigsRules } from "./use-gigs";
import social from "@/components/social/social.module.css";
import styles from "@/components/shop/shop.module.css";

/** Waits this long after the last keystroke before filtering by city. */
const CITY_DELAY_MS = 350;

function Cards({ query }: { query: GigsQuery }) {
  const onSignedOut = useOnSignedOut();
  const { items, loading, loadingMore, hasMore, error, more, reload } = usePages((cursor) => listGigs(query, cursor));
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
      <Empty title="Could not load gigs">
        <p>{formError(error).message}</p>
        <Button variant="secondary" onClick={reload}>
          Try again
        </Button>
      </Empty>
    );
  }
  if (items.length === 0) {
    const filtered = Object.keys(query).length > 0;
    return (
      <Empty title={filtered ? "No gigs match" : "No gigs yet"}>
        <p>{filtered ? "Try another category, city or word." : "Designers, editors, writers and more show their packages here as soon as they start."}</p>
      </Empty>
    );
  }
  return (
    <>
      <ul className={styles.grid}>
        {items.map((gig, i) => (
          <li key={gig.id}>
            <GigCard gig={gig} index={i} eager={i < 3} />
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

/** Freelancers' gigs for Discover: a category and a city. The search box matches titles and names. Same as the app. */
export default function GigResults({ q }: { q: string }) {
  const rules = useGigsRules();
  const [category, setCategory] = useState("");
  const [cityText, setCityText] = useState("");
  const [city, setCity] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setCity(cityText.trim()), CITY_DELAY_MS);
    return () => clearTimeout(t);
  }, [cityText]);

  if (!rules.data) {
    if (rules.error) {
      return (
        <Empty title="Could not load freelancers">
          <p>{formError(rules.error).message}</p>
          <Button variant="secondary" onClick={rules.reload}>
            Try again
          </Button>
        </Empty>
      );
    }
    return (
      <div className={styles.grid} aria-busy>
        <ShopCardSkeleton />
        <ShopCardSkeleton />
      </div>
    );
  }

  const query: GigsQuery = {
    ...(q ? { q: q.slice(0, 60) } : {}),
    ...(city.length >= 2 ? { city: city.slice(0, 60) } : {}),
    ...(category ? { category } : {}),
  };
  return (
    <>
      <FilterRow label="Gig filters">
        <FilterSelect
          label="Category"
          value={category}
          onChange={setCategory}
          options={[{ value: "", label: "Every category" }, ...rules.data.categories.map((c) => ({ value: c.key, label: c.label }))]}
        />
      </FilterRow>
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
      <Cards key={JSON.stringify(query)} query={query} />
    </>
  );
}
