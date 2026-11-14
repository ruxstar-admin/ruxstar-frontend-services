"use client";

import { useEffect, useState } from "react";
import { Button, ButtonLink, Icon } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { ShopCard, ShopCardSkeleton } from "@/components/shop/ShopCard";
import { formError } from "@/lib/api/account";
import { discoverCatalog, MODULE_LABEL, shops, type BusinessModule, type Category, type PodProduct, type ShopFilters } from "@/lib/api/shops";
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

/** Businesses customers can order from: a category first, then what it offers. Same as the app's Discover tab. */
export function DiscoverScreen() {
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<BusinessModule | null>(null);
  const [product, setProduct] = useState<PodProduct | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<{ id: PodProduct; label: string }[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [text]);

  useEffect(() => {
    discoverCatalog().then((c) => {
      setCategories(c.categories);
      setProducts(c.podProducts);
    }, () => undefined);
  }, []);

  const picked = categories.find((c) => c.module === category);
  const comingSoon = picked ? !picked.live || picked.module !== "pod" : false;
  const printOpen = categories.some((c) => c.module === "pod" && c.live) && category !== "pod";
  const filters: ShopFilters = { ...(q ? { q } : {}), ...(category === "pod" && product ? { product } : {}) };

  const pickCategory = (next: BusinessModule | null) => {
    setCategory(next);
    setProduct(null);
  };

  return (
    <div className={styles.page}>
      <div className={styles.headRow}>
        <div className={styles.head}>
          <h1 className={styles.title}>Discover</h1>
          <p className={styles.subtitle}>Businesses on Ruxstar</p>
        </div>
        <ButtonLink href="/orders" variant="secondary">
          Your orders
        </ButtonLink>
      </div>
      <label className={social.searchBox}>
        <Icon name="search" size={20} />
        <input
          className={social.searchInput}
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Shop, what they print, or a city"
          aria-label="Search businesses"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <div className={styles.filters}>
        <div className={styles.chips} role="group" aria-label="Category">
          <button type="button" className={styles.chip} aria-pressed={category === null} onClick={() => pickCategory(null)}>
            All
          </button>
          {categories.map((c) => (
            <button key={c.module} type="button" className={styles.chip} aria-pressed={category === c.module} onClick={() => pickCategory(c.module)}>
              {MODULE_LABEL[c.module]}
            </button>
          ))}
        </div>
        {category === "pod" && !comingSoon && (
          <div className={styles.chips} role="group" aria-label="What they print">
            <button type="button" className={styles.subChip} aria-pressed={product === null} onClick={() => setProduct(null)}>
              All print
            </button>
            {products.map((p) => (
              <button key={p.id} type="button" className={styles.subChip} aria-pressed={product === p.id} onClick={() => setProduct(p.id)}>
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>
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
      ) : (
        <Results key={`${q}|${category ?? ""}|${product ?? ""}`} filters={filters} />
      )}
    </div>
  );
}
