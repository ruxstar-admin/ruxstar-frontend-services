"use client";

import { useCallback, useEffect, useId, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { usePages } from "@/components/social/use-pages";
import { CourseCard } from "@/components/coaching/CourseCard";
import { EventCard } from "@/components/events/EventCard";
import { GigCard } from "@/components/gigs/GigCard";
import { ShopCard, ShopCardSkeleton } from "@/components/shop/ShopCard";
import { PropertyCard } from "@/components/stays/PropertyCard";
import { StoreCard } from "@/components/store/cards";
import { GroundCard } from "@/components/turf/GroundCard";
import { listCourses } from "@/lib/api/coaching";
import { listEvents } from "@/lib/api/events";
import { listGigs } from "@/lib/api/gigs";
import { MODULE_LABEL, shops, type BusinessModule } from "@/lib/api/shops";
import type { Page } from "@/lib/api/social";
import { listProperties } from "@/lib/api/stays";
import { listStores } from "@/lib/api/store";
import { listGrounds } from "@/lib/api/turf";
import { MODULE_ICON } from "@/lib/api/vendor";
import styles from "@/components/shop/shop.module.css";

/** How many of each kind the All page shows before "See all". */
const PER_SECTION = 3;

const first = <T,>(page: Promise<Page<T>>, draw: (item: T, index: number) => ReactNode): Promise<Page<ReactNode>> =>
  page.then((p) => ({ items: p.items.slice(0, PER_SECTION).map(draw), nextCursor: null }));

/** The first few of one kind, as grid items. */
function load(module: BusinessModule, q: string): Promise<Page<ReactNode>> {
  const query = q ? { q } : {};
  const short = q ? { q: q.slice(0, 60) } : {};
  switch (module) {
    case "pod":
      return first(shops(query), (s, i) => (
        <li key={s.id}>
          <ShopCard shop={s} index={i} />
        </li>
      ));
    case "events":
      return first(listEvents(query), (e, i) => (
        <li key={e.id}>
          <EventCard event={e} index={i} />
        </li>
      ));
    case "coaching":
      return first(listCourses(query), (c, i) => (
        <li key={c.id}>
          <CourseCard course={c} index={i} />
        </li>
      ));
    case "turf":
      return first(listGrounds(short), (g, i) => (
        <li key={g.id}>
          <GroundCard ground={g} index={i} />
        </li>
      ));
    case "stays":
      return first(listProperties(short), (p, i) => (
        <li key={p.id}>
          <PropertyCard property={p} index={i} />
        </li>
      ));
    case "shop":
      return first(listStores(short), (s, i) => (
        <li key={s.id}>
          <StoreCard store={s} index={i} />
        </li>
      ));
    case "gigs":
      return first(listGigs(short), (g, i) => (
        <li key={g.id}>
          <GigCard gig={g} index={i} />
        </li>
      ));
    default:
      return Promise.resolve({ items: [], nextCursor: null });
  }
}

function Section({
  module,
  q,
  onSeeAll,
  onShown,
}: {
  module: BusinessModule;
  q: string;
  onSeeAll: () => void;
  onShown: (module: BusinessModule, shown: boolean) => void;
}) {
  const headingId = useId();
  const onSignedOut = useOnSignedOut();
  const { items, loading, error, reload } = usePages(() => load(module, q));
  const empty = !loading && !error && items.length === 0;

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  useEffect(() => {
    if (!loading) onShown(module, !empty);
  }, [loading, empty, module, onShown]);

  if (empty) return null;
  const label = MODULE_LABEL[module];
  return (
    <section className={styles.allSection} aria-labelledby={headingId}>
      <div className={styles.allHead}>
        <Icon name={MODULE_ICON[module]} size={20} />
        <h2 id={headingId} className={styles.allTitle}>
          {label}
        </h2>
        {items.length > 0 && (
          <button type="button" className={styles.seeAll} onClick={onSeeAll} aria-label={`See all ${label.toLowerCase()}`}>
            See all
          </button>
        )}
      </div>
      {loading ? (
        <div className={styles.grid} aria-busy>
          <ShopCardSkeleton />
          <ShopCardSkeleton />
          <ShopCardSkeleton />
        </div>
      ) : error && items.length === 0 ? (
        <div className={styles.allFailed} role="alert">
          <span>{`Couldn’t load ${label.toLowerCase()}.`}</span>
          <button type="button" className={styles.mutedLink} onClick={reload}>
            Try again
          </button>
        </div>
      ) : (
        <ul className={styles.grid}>{items}</ul>
      )}
    </section>
  );
}

/** Every kind of business at once, a few of each, until the customer picks a type. The search box searches them all. Same as the app. */
export default function AllBusinesses({ modules, q, onPick }: { modules: readonly BusinessModule[]; q: string; onPick: (module: BusinessModule) => void }) {
  const [shown, setShown] = useState<Partial<Record<BusinessModule, boolean>>>({});
  const settled = modules.every((m) => shown[m] !== undefined);
  const nothing = settled && modules.every((m) => !shown[m]);
  const mark = useCallback((module: BusinessModule, on: boolean) => setShown((s) => (s[module] === on ? s : { ...s, [module]: on })), []);

  return (
    <div className={styles.all}>
      {modules.map((m) => (
        <Section key={m} module={m} q={q} onSeeAll={() => onPick(m)} onShown={mark} />
      ))}
      {nothing && (
        <Empty title={q ? "Nothing matches" : "No businesses yet"}>
          <p>{q ? "Try another name or city." : "Businesses on Ruxstar show up here as soon as they open."}</p>
        </Empty>
      )}
    </div>
  );
}
