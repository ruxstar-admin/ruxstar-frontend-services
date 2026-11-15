"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, ButtonLink, Icon, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useMe } from "@/components/social/session";
import { usePages } from "@/components/social/use-pages";
import { Fact } from "@/components/stays/pieces";
import { ProductTile } from "@/components/store/cards";
import { cartCount, useCart } from "@/components/store/cart";
import { formError } from "@/lib/api/account";
import { ApiError } from "@/lib/api/client";
import { ratingLine } from "@/lib/api/reviews";
import { coverGradient, initialOf, money } from "@/lib/api/shops";
import type { Page } from "@/lib/api/social";
import { getStore, listProducts, type ProductCard, type StoreDetail } from "@/lib/api/store";
import { deliveryAreaLine, directionsUrl, feeLine, methodsLine, plural, storeTypeLabel } from "@/lib/store";
import social from "@/components/social/social.module.css";
import shop from "@/components/shop/shop.module.css";
import order from "@/components/shop/order.module.css";
import events from "@/components/events/events.module.css";
import styles from "@/components/store/store.module.css";

const DEBOUNCE_MS = 300;
const PAGE_SIZE = 24;

function Products({ storeId, q, initial }: { storeId: string; q: string; initial?: Page<ProductCard> }) {
  const load = useCallback((cursor?: string) => listProducts({ shop: storeId, ...(q ? { q } : {}) }, cursor, PAGE_SIZE), [storeId, q]);
  const { items, loading, loadingMore, hasMore, moreFailed, error, more, reload } = usePages(load, initial);
  if (loading) {
    return (
      <ul className={styles.products} aria-busy>
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className={shop.skeletonCard} />
        ))}
      </ul>
    );
  }
  if (error && !items.length) {
    return (
      <div className={social.failed} role="alert">
        <p>{formError(error).message}</p>
        <Button variant="secondary" onClick={reload}>
          Try again
        </Button>
      </div>
    );
  }
  if (!items.length) {
    return <p className={order.small}>{q ? "Nothing here matches. Try another word." : "No products yet. Check back soon."}</p>;
  }
  return (
    <>
      <ul className={styles.products}>
        {items.map((p, i) => (
          <li key={p.id}>
            <ProductTile product={p} eager={i < 4} />
          </li>
        ))}
      </ul>
      {moreFailed && error ? (
        <p className={order.error} role="alert">
          {formError(error).message}
        </p>
      ) : null}
      {hasMore && (
        <div>
          <Button variant="secondary" loading={loadingMore} onClick={more}>
            {moreFailed ? "Try again" : "Show more products"}
          </Button>
        </div>
      )}
    </>
  );
}

function StoreView({ store, products }: { store: StoreDetail; products: Page<ProductCard> | null }) {
  const cart = useCart();
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const { setup } = store;
  const photos = store.photos;
  const inCart = cart?.shop.id === store.id ? cartCount(cart) : 0;

  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim().slice(0, 60)), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [text]);

  return (
    <div className={order.page}>
      {photos.length > 1 ? (
        <ul className={styles.gallery} aria-label="Photos">
          {photos.map((p, i) => (
            <li key={p.url}>
              <img src={p.url} width={p.width} height={p.height} alt={`Photo ${i + 1} of ${store.name}`} loading={i === 0 ? "eager" : "lazy"} decoding="async" />
            </li>
          ))}
        </ul>
      ) : photos[0] ? (
        <div className={styles.cover}>
          <img src={photos[0].url} width={photos[0].width} height={photos[0].height} alt={`Photo of ${store.name}`} decoding="async" />
        </div>
      ) : (
        <div className={shop.cover} style={{ background: coverGradient(store.name), borderRadius: "var(--radius-card)" }}>
          <span className={shop.initial} aria-hidden>
            {initialOf(store.name)}
          </span>
        </div>
      )}

      <div className={order.titleRow}>
        <div className={shop.head}>
          <h1 className={events.eventTitle}>{store.name}</h1>
          <p className={events.byLine}>{`${storeTypeLabel(store.type)} · ${[store.area, store.city].filter(Boolean).join(", ")}`}</p>
        </div>
        <Tag tone={store.open ? "success" : "neutral"}>{store.open ? "Open" : "Closed"}</Tag>
      </div>

      {!store.canOrder && store.whyNot && (
        <div className={order.news} role="status">
          <p className={order.small}>{store.whyNot}</p>
        </div>
      )}

      <div className={shop.panel}>
        <Fact icon="map-pin" title={store.address} detail={store.phone ? `Phone ${store.phone}` : null} />
        <Fact
          icon="truck"
          title={methodsLine(setup)}
          detail={[setup.delivery ? `${deliveryAreaLine(setup, store.city)} · ${feeLine(setup.deliveryFee)}` : null, setup.pickup ? "Pick up from the shop" : null]
            .filter(Boolean)
            .join(" · ")}
        />
        {setup.minOrder > 0 && <Fact icon="bag" title={`Smallest order ${money(setup.minOrder)}`} />}
        <Fact icon="return" title={store.returnDays ? `Returns within ${plural(store.returnDays, "day")}` : "No returns"} detail={store.returnRule} />
        {store.rating.count > 0 && <Fact icon="star" title={ratingLine(store.rating)} detail="Across the shop’s products" />}
        <a className={events.textLink} href={directionsUrl({ name: store.name, address: store.address, point: store.point })} target="_blank" rel="noreferrer">
          Get directions
        </a>
      </div>

      {(store.description || setup.notes) && (
        <section className={order.section}>
          <h2 className={order.overline}>About</h2>
          {store.description && <p className={shop.text}>{store.description}</p>}
          {setup.notes && <p className={order.small}>{setup.notes}</p>}
        </section>
      )}

      <section className={order.section}>
        <div className={styles.searchRow}>
          <h2 className={order.overline}>{`Products · ${store.products}`}</h2>
        </div>
        {store.products > 8 && (
          <label className={social.searchBox}>
            <Icon name="search" size={20} />
            <input
              className={social.searchInput}
              type="search"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Search ${store.name}`}
              aria-label="Search this shop"
              autoComplete="off"
              maxLength={60}
            />
          </label>
        )}
        <Products key={q} storeId={store.id} q={q} initial={!q && products ? products : undefined} />
      </section>

      {inCart > 0 && (
        <div className={shop.orderBar}>
          <span className={shop.orderText}>
            <strong>{`${plural(inCart, "item")} in your cart`}</strong>
            <span className={order.faint}>{store.name}</span>
          </span>
          <ButtonLink href="/cart" icon={<Icon name="bag" size={18} />}>
            View cart
          </ButtonLink>
        </div>
      )}
    </div>
  );
}

/**
 * A local shop: photos, where it is, delivery or pickup with the fee, returns, and its products. The page arrives from the
 * server with the shop and its first products; when you're signed in the shop is fetched again here, so its owner sees
 * why nobody can order and everyone sees whether it is open right now.
 */
export function StoreScreen({ id, initial, products }: { id: string; initial: StoreDetail | null; products: Page<ProductCard> | null }) {
  const me = useMe();
  const [full, setFull] = useState<StoreDetail | null>(null);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(
    () =>
      getStore(id).then(
        (s) => {
          setFull(s);
          setError(null);
        },
        (err: unknown) => setError(err),
      ),
    [id],
  );

  useEffect(() => {
    if (me === undefined) return;
    if (me === null) {
      if (!initial) void load();
      return;
    }
    void load();
  }, [me, load, initial]);

  const store = full ?? initial;
  if (store) return <StoreView store={store} products={products} />;
  if (error) {
    const gone = error instanceof ApiError && error.status === 404;
    return (
      <Empty title={gone ? "Shop not found" : "Could not load this shop"}>
        <p>{gone ? "It may have closed on Ruxstar or the link is wrong." : formError(error).message}</p>
        {gone ? (
          <ButtonLink href="/discover?category=shop" variant="secondary">
            Find shops
          </ButtonLink>
        ) : (
          <Button variant="secondary" icon={<Icon name="refresh" size={16} />} onClick={() => void load()}>
            Try again
          </Button>
        )}
      </Empty>
    );
  }
  return (
    <div className={order.page} aria-busy>
      <div className={shop.skeletonCard} />
    </div>
  );
}
