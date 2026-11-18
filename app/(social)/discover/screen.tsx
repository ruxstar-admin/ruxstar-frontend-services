"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, ButtonLink, Icon, type IconName } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useMe, useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { FilterRow, FilterSelect } from "@/components/shop/FilterSelect";
import { ShopCard, ShopCardSkeleton } from "@/components/shop/ShopCard";
import { formError } from "@/lib/api/account";
import {
  discoverCatalog,
  GUEST_MODULES,
  MODULE_LABEL,
  shops,
  type BusinessModule,
  type Category,
  type PodProduct,
  type ShopFilters,
} from "@/lib/api/shops";
import social from "@/components/social/social.module.css";
import styles from "@/components/shop/shop.module.css";

const DEBOUNCE_MS = 300;
/** Categories the website can show; the rest say "coming soon". */
const OPEN_ON_WEB: BusinessModule[] = ["pod", "events", "coaching", "turf", "stays", "shop", "gigs"];

/** Its own chunk: people who never open Events don't download it. */
const EventResults = dynamic(() => import("@/components/events/EventResults"), {
  loading: () => (
    <div className={styles.grid} aria-busy>
      <ShopCardSkeleton />
      <ShopCardSkeleton />
    </div>
  ),
});

const CourseResults = dynamic(() => import("@/components/coaching/CourseResults"), {
  loading: () => (
    <div className={styles.grid} aria-busy>
      <ShopCardSkeleton />
      <ShopCardSkeleton />
    </div>
  ),
});

const GroundResults = dynamic(() => import("@/components/turf/GroundResults"), {
  loading: () => (
    <div className={styles.grid} aria-busy>
      <ShopCardSkeleton />
      <ShopCardSkeleton />
    </div>
  ),
});

const PropertyResults = dynamic(() => import("@/components/stays/PropertyResults"), {
  loading: () => (
    <div className={styles.grid} aria-busy>
      <ShopCardSkeleton />
      <ShopCardSkeleton />
    </div>
  ),
});

const StoreResults = dynamic(() => import("@/components/store/StoreResults"), {
  loading: () => (
    <div className={styles.grid} aria-busy>
      <ShopCardSkeleton />
      <ShopCardSkeleton />
    </div>
  ),
});

const GigResults = dynamic(() => import("@/components/gigs/GigResults"), {
  loading: () => (
    <div className={styles.grid} aria-busy>
      <ShopCardSkeleton />
      <ShopCardSkeleton />
    </div>
  ),
});

const AllBusinesses = dynamic(() => import("@/components/discover/AllBusinesses"), {
  loading: () => (
    <div className={styles.grid} aria-busy>
      <ShopCardSkeleton />
      <ShopCardSkeleton />
    </div>
  ),
});

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
      <Empty title={searching ? "No businesses match" : "No businesses yet"}>
        <p>{searching ? "Try another product or name." : "Businesses on Ruxstar show up here as soon as they open."}</p>
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

function Shortcut({ href, icon, label, spoken }: { href: string; icon: IconName; label: string; spoken: string }) {
  return (
    <Link href={href} className={styles.shortcut} aria-label={spoken}>
      <span className={styles.shortcutIcon}>
        <Icon name={icon} size={20} />
      </span>
      <span className={styles.shortcutLabel}>{label}</span>
    </Link>
  );
}

const SEARCH_HINT: Partial<Record<BusinessModule, { placeholder: string; label: string }>> = {
  pod: { placeholder: "Shop, what they print, or a city", label: "Search print shops" },
  events: { placeholder: "Event, organiser or city", label: "Search events" },
  coaching: { placeholder: "Course or institute", label: "Search courses" },
  turf: { placeholder: "Ground or business", label: "Search grounds" },
  stays: { placeholder: "PG, hostel or business", label: "Search PGs and hostels" },
  shop: { placeholder: "Shop name", label: "Search shops" },
  gigs: { placeholder: "Gig or freelancer", label: "Search freelancers" },
};

/**
 * Businesses customers can order from: every kind at once, until they pick a type and then what it offers. Same as the app's
 * Discover tab. Signed out, everything the API lists without an account can be browsed; print shops ask to sign in.
 */
export function DiscoverScreen({ initialCategory = null }: { initialCategory?: BusinessModule | null }) {
  const onSignedOut = useOnSignedOut();
  const me = useMe();
  const [guest, setGuest] = useState(false);
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<BusinessModule | null>(initialCategory);
  const [product, setProduct] = useState<PodProduct | "">("");
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [products, setProducts] = useState<{ id: PodProduct; label: string }[]>([]);
  const [catalogError, setCatalogError] = useState<unknown>(null);
  const [catalogTry, setCatalogTry] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [text]);

  useEffect(() => {
    let live = true;
    discoverCatalog().then(
      (c) => {
        if (!live) return;
        setCategories(c.categories);
        setProducts(c.podProducts);
        setGuest(c.guest);
        setCatalogError(null);
      },
      (err) => {
        if (live && !onSignedOut(err)) setCatalogError(err);
      },
    );
    return () => {
      live = false;
    };
  }, [catalogTry, onSignedOut]);

  const known = categories ?? [];
  const isLive = (module: BusinessModule) => known.some((c) => c.module === module && c.live);
  const browsable = known
    .filter((c) => c.live && OPEN_ON_WEB.includes(c.module) && (!guest || GUEST_MODULES.includes(c.module)))
    .map((c) => c.module);
  const types = categories ? known.map((c) => c.module) : category ? [category] : [];
  const picked = known.find((c) => c.module === category);
  const comingSoon = picked ? !picked.live || !OPEN_ON_WEB.includes(picked.module) : false;
  const printOpen = isLive("pod") && category !== "pod";
  const shown = comingSoon ? null : category;
  const hint = (shown && SEARCH_HINT[shown]) || { placeholder: "Search all businesses", label: "Search businesses" };
  const filters: ShopFilters = { ...(q ? { q } : {}), ...(category === "pod" && product ? { product } : {}) };

  const pickCategory = (next: BusinessModule | null) => {
    setCategory(next);
    setProduct("");
  };

  return (
    <div className={styles.page}>
      <h1 className="sr-only">Discover</h1>
      {!guest && me !== null && (
        <nav className={styles.shortcuts} aria-label="Your bookings and orders">
          {isLive("events") && <Shortcut href="/tickets" icon="ticket" label="Tickets" spoken="Your tickets" />}
          {isLive("coaching") && <Shortcut href="/classes" icon="book" label="Classes" spoken="Your classes" />}
          {isLive("turf") && <Shortcut href="/bookings" icon="ball" label="Grounds" spoken="Your ground bookings" />}
          {isLive("stays") && <Shortcut href="/reservations" icon="home" label="Stays" spoken="Your stays" />}
          {shown === "shop" && <Shortcut href="/cart" icon="bag" label="Cart" spoken="Your cart" />}
          <Shortcut
            href={shown === "shop" ? "/orders?tab=shops" : shown === "gigs" ? "/orders?tab=freelance" : "/orders"}
            icon="receipt"
            label="Orders"
            spoken={shown === "gigs" ? "Your freelance orders" : "Your orders"}
          />
          <Shortcut href="/payments" icon="wallet" label="Payments" spoken="Your payments" />
        </nav>
      )}
      <label className={social.searchBox}>
        <Icon name="search" size={20} />
        <input
          className={social.searchInput}
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={hint.placeholder}
          aria-label={hint.label}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <FilterRow label="Filters">
        <FilterSelect
          label="Type of business"
          value={category ?? ""}
          onChange={(next) => pickCategory(next || null)}
          options={[{ value: "", label: "All businesses" }, ...types.map((m) => ({ value: m, label: MODULE_LABEL[m] }))]}
        />
        {shown === "pod" && (
          <FilterSelect
            label="What they print"
            value={product}
            onChange={setProduct}
            options={[{ value: "", label: "All print" }, ...products.map((p) => ({ value: p.id, label: p.label }))]}
          />
        )}
        {category !== null && (
          <button type="button" className={`${styles.mutedLink} ${styles.clear}`} aria-label="Clear type of business" onClick={() => pickCategory(null)}>
            Clear
          </button>
        )}
      </FilterRow>
      {comingSoon && picked ? (
        <Empty title={`${MODULE_LABEL[picked.module]} coming soon`}>
          <p>
            {picked.label} open on Ruxstar soon.{printOpen && " Print shops are open now."}
          </p>
          {printOpen && (
            <Button variant="secondary" onClick={() => pickCategory("pod")}>
              See print shops
            </Button>
          )}
        </Empty>
      ) : shown === "events" ? (
        <EventResults q={q} />
      ) : shown === "coaching" ? (
        <CourseResults q={q} />
      ) : shown === "turf" ? (
        <GroundResults q={q} />
      ) : shown === "stays" ? (
        <PropertyResults q={q} />
      ) : shown === "shop" ? (
        <StoreResults q={q} />
      ) : shown === "gigs" ? (
        <GigResults q={q} />
      ) : shown === "pod" && guest ? (
        <Empty title="Sign in to see print shops">
          <p>Events, courses, grounds, stays, local shops and freelancers are open to browse without an account.</p>
          <ButtonLink href={`/signin?next=${encodeURIComponent("/discover?category=pod")}`}>Sign in</ButtonLink>
        </Empty>
      ) : shown === "pod" ? (
        <Results key={`${q}|${product}`} filters={filters} />
      ) : categories ? (
        <AllBusinesses key={q} modules={browsable} q={q} onPick={pickCategory} />
      ) : catalogError ? (
        <div className={social.failed} role="alert">
          <p>{formError(catalogError).message}</p>
          <Button
            variant="secondary"
            onClick={() => {
              setCatalogError(null);
              setCatalogTry((n) => n + 1);
            }}
          >
            Try again
          </Button>
        </div>
      ) : (
        <div className={styles.grid} aria-busy>
          <ShopCardSkeleton />
          <ShopCardSkeleton />
          <ShopCardSkeleton />
        </div>
      )}
    </div>
  );
}
