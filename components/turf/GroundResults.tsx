"use client";

import { useEffect, useState } from "react";
import { Button, Icon } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { ShopCardSkeleton } from "@/components/shop/ShopCard";
import { formError } from "@/lib/api/account";
import { listGrounds, listSports, type GroundFilters, type Sport } from "@/lib/api/turf";
import { GroundCard } from "./GroundCard";
import social from "@/components/social/social.module.css";
import styles from "@/components/shop/shop.module.css";

const DEBOUNCE_MS = 300;

function Cards({ filters }: { filters: GroundFilters }) {
  const onSignedOut = useOnSignedOut();
  const { items, loading, loadingMore, hasMore, error, more, reload } = usePages((cursor) => listGrounds(filters, cursor));
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
    const searching = Boolean(filters.q || filters.sport || filters.city);
    return (
      <Empty title={searching ? "No grounds match" : "No grounds yet"}>
        <p>{searching ? "Try another sport, city or name." : "Turfs, courts and nets on Ruxstar show up here as soon as they open for bookings."}</p>
      </Empty>
    );
  }
  return (
    <>
      <ul className={styles.grid}>
        {items.map((ground, i) => (
          <li key={ground.id}>
            <GroundCard ground={ground} index={i} eager={i < 3} />
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

/** Grounds taking bookings, for Discover: filter by sport and city; the search box matches ground and business names. Same as the app. */
export default function GroundResults({ q }: { q: string }) {
  const [sports, setSports] = useState<Sport[]>([]);
  const [sport, setSport] = useState<string | null>(null);
  const [cityText, setCityText] = useState("");
  const [city, setCity] = useState("");

  useEffect(() => {
    listSports().then(setSports, () => undefined);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setCity(cityText.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [cityText]);

  const filters: GroundFilters = { ...(q ? { q: q.slice(0, 60) } : {}), ...(sport ? { sport } : {}), ...(city.length >= 2 ? { city: city.slice(0, 60) } : {}) };
  return (
    <>
      {sports.length > 0 && (
        <div className={styles.chips} role="group" aria-label="Sport">
          <button type="button" className={styles.subChip} aria-pressed={sport === null} onClick={() => setSport(null)}>
            All sports
          </button>
          {sports.map((s) => (
            <button key={s.key} type="button" className={styles.subChip} aria-pressed={sport === s.key} onClick={() => setSport(s.key)}>
              {s.name}
            </button>
          ))}
        </div>
      )}
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
      <Cards key={`${filters.q ?? ""}|${sport ?? ""}|${filters.city ?? ""}`} filters={filters} />
    </>
  );
}
