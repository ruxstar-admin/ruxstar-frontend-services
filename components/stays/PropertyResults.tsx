"use client";

import { useEffect, useState } from "react";
import { Button, Icon } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { FilterRow, FilterSelect } from "@/components/shop/FilterSelect";
import { ShopCardSkeleton } from "@/components/shop/ShopCard";
import { formError } from "@/lib/api/account";
import { listFacilities, listProperties, type Facility, type Occupant, type PropertyFilters, type RoomKind, type StayKind } from "@/lib/api/stays";
import { KIND_LABEL, KINDS, OCCUPANT_LABEL } from "@/lib/stays";
import { PropertyCard } from "./PropertyCard";
import social from "@/components/social/social.module.css";
import styles from "@/components/shop/shop.module.css";
import stays from "./stays.module.css";

const DEBOUNCE_MS = 300;
/** Monthly budgets, in rupees. */
const BUDGETS = [6000, 10000, 15000, 25000];
/** Most days of notice to move out. */
const NOTICES = [0, 15, 30];
const ALLOWS = [
  { key: "late_entry", label: "No curfew" },
  { key: "guests", label: "Guests allowed" },
  { key: "pets", label: "Pets allowed" },
  { key: "smoking", label: "Smoking allowed" },
  { key: "alcohol", label: "Alcohol allowed" },
];
type FoodPick = "any" | "veg" | null;

function Cards({ filters }: { filters: PropertyFilters }) {
  const onSignedOut = useOnSignedOut();
  const { items, loading, loadingMore, hasMore, error, more, reload } = usePages((cursor) => listProperties(filters, cursor));
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
    const searching = Object.keys(filters).length > 0;
    return (
      <Empty title={searching ? "No places match" : "No PGs or hostels yet"}>
        <p>{searching ? "Try another city, or fewer filters." : "PGs, hostels and co-living places on Ruxstar show up here as soon as they open for reservations."}</p>
      </Empty>
    );
  }
  return (
    <>
      <ul className={styles.grid}>
        {items.map((property, i) => (
          <li key={property.id}>
            <PropertyCard property={property} index={i} eager={i < 3} />
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

function Chips<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T | null; label: string }[];
  value: T | null;
  onChange: (value: T | null) => void;
}) {
  return (
    <div className={styles.chips} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" className={styles.subChip} aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** PGs and hostels taking reservations, for Discover. The search box matches property and business names. */
export default function PropertyResults({ q }: { q: string }) {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [kind, setKind] = useState<StayKind | "">("");
  const [forWhom, setForWhom] = useState<"men" | "women" | null>(null);
  const [room, setRoom] = useState<RoomKind | null>(null);
  const [budget, setBudget] = useState<number | null>(null);
  const [food, setFood] = useState<FoodPick>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [occupant, setOccupant] = useState<Occupant | null>(null);
  const [allows, setAllows] = useState<string[]>([]);
  const [notice, setNotice] = useState<number | null>(null);
  const [cityText, setCityText] = useState("");
  const [areaText, setAreaText] = useState("");
  const [nearText, setNearText] = useState("");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [near, setNear] = useState("");

  useEffect(() => {
    listFacilities().then(setFacilities, () => undefined);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setCity(cityText.trim());
      setArea(areaText.trim());
      setNear(nearText.trim());
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [cityText, areaText, nearText]);

  const filters: PropertyFilters = {
    ...(q ? { q: q.slice(0, 60) } : {}),
    ...(kind ? { kind } : {}),
    ...(forWhom ? { for: forWhom } : {}),
    ...(room ? { room } : {}),
    ...(budget ? { stay: "month" as const, priceMax: budget * 100 } : {}),
    ...(food ? { food } : {}),
    ...(picked.length ? { facilities: picked.join(",") } : {}),
    ...(city.length >= 2 ? { city: city.slice(0, 60) } : {}),
    ...(area.length >= 2 ? { area: area.slice(0, 60) } : {}),
    ...(occupant ? { occupant } : {}),
    ...(allows.length ? { allows: allows.join(",") } : {}),
    ...(notice !== null ? { noticeMax: notice } : {}),
    ...(near.length >= 2 ? { near: near.slice(0, 60) } : {}),
  };
  const narrowed =
    [forWhom, room, budget, food, occupant, area.length >= 2 ? area : null, near.length >= 2 ? near : null].filter(Boolean).length +
    (notice !== null ? 1 : 0) +
    picked.length +
    allows.length;
  const toggle = (key: string) => setPicked((now) => (now.includes(key) ? now.filter((k) => k !== key) : [...now, key]));
  const toggleAllow = (key: string) => setAllows((now) => (now.includes(key) ? now.filter((k) => k !== key) : [...now, key]));

  return (
    <>
      <FilterRow label="Stay filters">
        <FilterSelect label="Kind of place" value={kind} onChange={setKind} options={[{ value: "", label: "All kinds" }, ...KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))]} />
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
      <details className={stays.more}>
        <summary>
          <Icon name="grid" size={18} />
          {narrowed ? `Filters · ${narrowed}` : "More filters"}
        </summary>
        <div className={stays.moreBody}>
          <Chips
            label="Who it's for"
            value={forWhom}
            onChange={setForWhom}
            options={[
              { value: null, label: "Anyone" },
              { value: "men", label: "Men" },
              { value: "women", label: "Women" },
            ]}
          />
          <Chips
            label="Who stays"
            value={occupant}
            onChange={setOccupant}
            options={[{ value: null, label: "Students or working" }, ...(["students", "working"] as const).map((o) => ({ value: o, label: OCCUPANT_LABEL[o] }))]}
          />
          <Chips
            label="Room"
            value={room}
            onChange={setRoom}
            options={[
              { value: null, label: "Any room" },
              { value: "private", label: "Private room" },
              { value: "shared", label: "Shared room" },
            ]}
          />
          <Chips
            label="Budget a month"
            value={budget}
            onChange={setBudget}
            options={[{ value: null, label: "Any budget" }, ...BUDGETS.map((b) => ({ value: b, label: `Up to ₹${b.toLocaleString("en-IN")} a month` }))]}
          />
          <Chips
            label="Food"
            value={food}
            onChange={setFood}
            options={[
              { value: null, label: "With or without food" },
              { value: "any", label: "Food included" },
              { value: "veg", label: "Veg food" },
            ]}
          />
          {facilities.length > 0 && (
            <div className={styles.chips} role="group" aria-label="Facilities">
              {facilities.map((f) => (
                <button key={f.key} type="button" className={styles.subChip} aria-pressed={picked.includes(f.key)} onClick={() => toggle(f.key)}>
                  {f.name}
                </button>
              ))}
            </div>
          )}
          <div className={styles.chips} role="group" aria-label="House rules">
            {ALLOWS.map((a) => (
              <button key={a.key} type="button" className={styles.subChip} aria-pressed={allows.includes(a.key)} onClick={() => toggleAllow(a.key)}>
                {a.label}
              </button>
            ))}
          </div>
          <Chips
            label="Notice to move out"
            value={notice}
            onChange={setNotice}
            options={[{ value: null, label: "Any notice" }, ...NOTICES.map((n) => ({ value: n, label: n === 0 ? "No notice" : `Up to ${n} days’ notice` }))]}
          />
          <label className={social.searchBox}>
            <Icon name="search" size={20} />
            <input
              className={social.searchInput}
              type="search"
              value={areaText}
              onChange={(e) => setAreaText(e.target.value)}
              placeholder="Any area"
              aria-label="Area"
              maxLength={60}
            />
          </label>
          <label className={social.searchBox}>
            <Icon name="map-pin" size={20} />
            <input
              className={social.searchInput}
              type="search"
              value={nearText}
              onChange={(e) => setNearText(e.target.value)}
              placeholder="Near a college, office or metro"
              aria-label="Near a college, office or metro"
              maxLength={60}
            />
          </label>
        </div>
      </details>
      <Cards key={JSON.stringify(filters)} filters={filters} />
    </>
  );
}
