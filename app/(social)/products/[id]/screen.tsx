"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, ButtonLink, Icon } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useMe } from "@/components/social/session";
import { ListingReviews } from "@/components/reviews/ListingReviews";
import { Fact, Stepper } from "@/components/stays/pieces";
import { PriceTag, ProductPhoto } from "@/components/store/cards";
import { addToCart, cartCount, MAX_QUANTITY, useCart } from "@/components/store/cart";
import { formError } from "@/lib/api/account";
import { ApiError } from "@/lib/api/client";
import { ratingLine, type Review } from "@/lib/api/reviews";
import type { Page } from "@/lib/api/social";
import { getProduct, type ProductDetail } from "@/lib/api/store";
import { findVariant, methodsLine, plural, stockLine, valueInStock, valueSold, variantOptions } from "@/lib/store";
import shop from "@/components/shop/shop.module.css";
import order from "@/components/shop/order.module.css";
import events from "@/components/events/events.module.css";
import styles from "@/components/store/store.module.css";

/** The first variant with stock, so the page opens on something that can be bought. */
function firstPick(p: ProductDetail): (string | null)[] {
  const v = p.variants.find((x) => x.stock > 0) ?? p.variants[0];
  return p.options.map((_, i) => v?.values[i] ?? null);
}

/** What is picked on the options before `index`; later options follow the earlier ones. */
const earlier = (picked: (string | null)[], index: number) => picked.map((p, j) => (j < index ? p : null));

/**
 * Up to two options, each a row of buttons. The first option's values are open when anything with them has stock; the
 * second's follow the first pick. A value that can't be bought is struck through and can't be picked.
 */
function VariantPicker({ product, picked, onPick }: { product: ProductDetail; picked: (string | null)[]; onPick: (index: number, value: string) => void }) {
  return (
    <>
      {product.options.map((option, i) => (
        <fieldset key={option.name} className={styles.picker}>
          <legend className={order.label}>
            {option.name}
            {picked[i] && <span className={order.faint}>{` · ${picked[i]}`}</span>}
          </legend>
          <div className={styles.values}>
            {option.values.map((value) => {
              const before = earlier(picked, i);
              const ok = valueInStock(product.variants, before, i, value);
              const why = valueSold(product.variants, before, i, value) ? "sold out" : "not available";
              return (
                <button
                  key={value}
                  type="button"
                  className={styles.value}
                  aria-pressed={picked[i] === value}
                  disabled={!ok}
                  aria-label={ok ? `${option.name} ${value}` : `${option.name} ${value}, ${why}`}
                  title={ok ? undefined : why === "sold out" ? "Sold out" : "Not sold in this combination"}
                  onClick={() => onPick(i, value)}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
    </>
  );
}

function ProductView({ product, reviews }: { product: ProductDetail; reviews: Page<Review> | null }) {
  const cart = useCart();
  const [picked, setPicked] = useState(() => firstPick(product));
  const [quantity, setQuantity] = useState(1);
  const [clash, setClash] = useState(false);
  const [added, setAdded] = useState(false);
  const variant = findVariant(product.variants, picked);
  const stock = variant?.stock ?? 0;
  const live = product.status === "live";
  const left = variant ? stockLine(stock) : null;
  const shopItems = cart?.shop.id === product.business.id ? cartCount(cart) : 0;

  const pick = (index: number, value: string) => {
    setAdded(false);
    setPicked((now) => {
      const next = now.map((v, i) => (i === index ? value : v));
      // A later option keeps its value when that combination has stock; otherwise it moves to the first that does.
      for (let i = index + 1; i < next.length; i++) {
        const before = earlier(next, i);
        if (next[i] !== null && valueInStock(product.variants, before, i, next[i]!)) continue;
        next[i] = product.options[i]!.values.find((x) => valueInStock(product.variants, before, i, x)) ?? null;
      }
      return next;
    });
    setQuantity(1);
  };

  const add = (replace = false) => {
    if (!variant) return;
    const ok = addToCart(
      { id: product.business.id, name: product.business.name },
      {
        productId: product.id,
        variantId: variant.id,
        quantity,
        title: product.title,
        options: variantOptions(product.options, variant),
        price: variant.price,
        mrp: variant.mrp,
        photoUrl: product.photo?.url ?? null,
      },
      replace,
    );
    setClash(!ok);
    setAdded(ok);
  };

  const max = Math.min(stock, MAX_QUANTITY);
  const canAdd = live && product.canOrder && !!variant && stock > 0;

  return (
    <div className={order.page}>
      <Link href={`/shops/${product.business.id}`} className={events.textLink}>
        <Icon name="arrow-left" size={16} /> {product.business.name}
      </Link>
      <div className={styles.productTop}>
        <ProductPhoto photo={product.photo} title={product.title} eager className={styles.photo} out={!product.inStock} />
        <div className={styles.picker}>
          <h1 className={events.eventTitle}>{product.title}</h1>
          {product.rating.count > 0 && <p className={order.small}>{ratingLine(product.rating)}</p>}
          {variant ? <PriceTag price={variant.price} mrp={variant.mrp} large /> : <PriceTag price={product.priceFrom} mrp={product.mrpFrom} from large />}
          {variant?.mrp && variant.mrp > variant.price && <span className={order.faint}>Inclusive of all taxes</span>}
          {left && <span className={stock > 0 ? styles.low : order.error}>{left}</span>}

          {product.status === "removed" && (
            <div className={order.news} role="status">
              <strong>Taken down</strong>
              <p className={order.small}>Ruxstar took this product down. It can’t be bought.</p>
            </div>
          )}
          {product.status === "hidden" && (
            <div className={order.news} role="status">
              <strong>Off sale</strong>
              <p className={order.small}>The shop took this product off sale. Only you can see it.</p>
            </div>
          )}

          <VariantPicker product={product} picked={picked} onPick={pick} />

          {canAdd && (
            <div className={styles.qtyRow}>
              <span className={order.label}>Quantity</span>
              <Stepper value={Math.min(quantity, max)} min={1} max={Math.max(1, max)} onChange={setQuantity} label="items" />
            </div>
          )}

          {clash ? (
            <div className={order.news} role="alert">
              <strong>Start a new cart?</strong>
              <p className={order.small}>{`Your cart has items from ${cart?.shop.name ?? "another shop"}. An order is from one shop, so adding this clears them.`}</p>
              <div className={order.actions}>
                <Button onClick={() => add(true)}>Clear cart and add</Button>
                <Button variant="ghost" onClick={() => setClash(false)}>
                  Keep my cart
                </Button>
              </div>
            </div>
          ) : (
            <div className={order.actions}>
              <Button size="lg" icon={<Icon name="bag" size={18} />} disabled={!canAdd} onClick={() => add()}>
                {!live ? "Not for sale" : !product.canOrder ? (product.whyNot ?? "Not taking orders") : !variant ? "Pick an option" : stock <= 0 ? "Sold out" : "Add to cart"}
              </Button>
              {shopItems > 0 && (
                <ButtonLink href="/cart" variant="secondary">
                  {added ? `Added · View cart (${shopItems})` : `View cart (${shopItems})`}
                </ButtonLink>
              )}
            </div>
          )}
          {added && (
            <p className={order.small} role="status">
              Added to your cart.
            </p>
          )}
          {!product.canOrder && product.whyNot && live && <p className={order.faint}>{product.whyNot}</p>}
        </div>
      </div>

      <div className={shop.panel}>
        <Fact icon="truck" title={methodsLine(product)} detail={`From ${product.business.name}, ${product.city}`} />
        <Fact icon="return" title={product.returnRule} />
      </div>

      {product.description && (
        <section className={order.section}>
          <h2 className={order.overline}>About this product</h2>
          <p className={shop.text}>{product.description}</p>
        </section>
      )}

      {product.variants.length > 1 && (
        <p className={order.faint}>{`${plural(product.variants.length, "choice")}${product.options.length ? ` across ${product.options.map((o) => o.name.toLowerCase()).join(" and ")}` : ""}.`}</p>
      )}

      {reviews && <ListingReviews module="shop" id={product.id} initial={reviews} />}
    </div>
  );
}

/**
 * One product: its photo, price and MRP, the variant picker with each combination's price and stock, and reviews. The page
 * arrives from the server; signed in, it is fetched again so stock is current and the owner sees a hidden product.
 */
export function ProductScreen({ id, initial, reviews }: { id: string; initial: ProductDetail | null; reviews: Page<Review> | null }) {
  const me = useMe();
  const [full, setFull] = useState<ProductDetail | null>(null);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(
    () =>
      getProduct(id).then(
        (p) => {
          setFull(p);
          setError(null);
        },
        (err: unknown) => setError(err),
      ),
    [id],
  );

  useEffect(() => {
    if (me === undefined) return;
    if (me === null && initial) return;
    void load();
  }, [me, load, initial]);

  const product = full ?? initial;
  if (product) return <ProductView key={product.id} product={product} reviews={reviews} />;
  if (error) {
    const gone = error instanceof ApiError && error.status === 404;
    return (
      <Empty title={gone ? "Product not found" : "Could not load this product"}>
        <p>{gone ? "The shop may have taken it off sale, or the link is wrong." : formError(error).message}</p>
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
