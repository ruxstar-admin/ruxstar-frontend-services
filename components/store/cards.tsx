import Link from "next/link";
import { Icon } from "@/components/ui";
import { coverGradient, initialOf, money } from "@/lib/api/shops";
import { ratingShort } from "@/lib/api/reviews";
import type { ProductCard, StoreCard as Card, StorePhoto } from "@/lib/api/store-types";
import { discountPercent, methodsLine, storeTypeLabel } from "@/lib/store";
import shop from "@/components/shop/shop.module.css";
import events from "@/components/events/events.module.css";
import styles from "./store.module.css";

/** The sale price, the MRP struck through when it is higher, and how much that is off. */
export function PriceTag({ price, mrp, from, large }: { price: number; mrp: number | null; from?: boolean; large?: boolean }) {
  const off = discountPercent(price, mrp);
  return (
    <span className={styles.price} data-large={large || undefined}>
      <strong>{`${from ? "From " : ""}${money(price)}`}</strong>
      {off > 0 && (
        <>
          <s aria-label={`MRP ${money(mrp!)}`}>{money(mrp!)}</s>
          <span className={styles.off}>{`${off}% off`}</span>
        </>
      )}
    </span>
  );
}

/** A product's one photo, square, or a bag when there is none. */
export function ProductPhoto({ photo, title, eager, className = styles.square, out }: { photo: StorePhoto | null; title: string; eager?: boolean; className?: string; out?: boolean }) {
  return (
    <span className={className} data-out={out || undefined}>
      {photo ? (
        <img src={photo.url} width={photo.width} height={photo.height} alt={title} loading={eager ? "eager" : "lazy"} decoding="async" />
      ) : (
        <Icon name="bag" size={36} />
      )}
    </span>
  );
}

/** A product in a shop's grid: photo, title, the price with the MRP struck, and "Sold out". */
export function ProductTile({ product, eager }: { product: ProductCard; eager?: boolean }) {
  const many = product.mrpFrom !== null && product.mrpFrom < product.priceFrom;
  return (
    <Link href={`/products/${product.id}`} className={styles.tile}>
      <span className={styles.square} data-out={!product.inStock || undefined}>
        {product.photo ? (
          <img src={product.photo.url} width={product.photo.width} height={product.photo.height} alt="" loading={eager ? "eager" : "lazy"} decoding="async" />
        ) : (
          <Icon name="bag" size={36} />
        )}
        {!product.inStock && <span className={styles.badge}>Sold out</span>}
      </span>
      <span className={styles.tileBody}>
        <span className={styles.tileTitle}>{product.title}</span>
        <PriceTag price={product.priceFrom} mrp={many ? null : product.mrpFrom} />
        {product.rating.count > 0 && (
          <span className={shop.faint}>
            <Icon name="star" size={12} filled /> {ratingShort(product.rating)}
          </span>
        )}
      </span>
    </Link>
  );
}

/** A local shop on Discover: cover, name, kind, where, delivery or pickup, and its rating. */
export function StoreCard({ store, eager, index }: { store: Card; eager?: boolean; index: number }) {
  return (
    <Link href={`/shops/${store.id}`} className={shop.card} style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}>
      <div className={shop.cover} data-closed={!store.open || undefined} style={store.photoUrl ? undefined : { background: coverGradient(store.name) }}>
        {store.photoUrl ? (
          <img src={store.photoUrl} width={640} height={360} alt={`Photo of ${store.name}`} loading={eager ? "eager" : "lazy"} decoding="async" />
        ) : (
          <span className={shop.initial} aria-hidden>
            {initialOf(store.name)}
          </span>
        )}
        <span className={shop.pill} data-open={store.open || undefined}>
          {store.open ? "Open" : "Closed"}
        </span>
      </div>
      <div className={shop.cardBody}>
        <span className={events.cardTitle}>{store.name}</span>
        <span className={shop.meta}>{`${storeTypeLabel(store.type)} · ${methodsLine(store)}`}</span>
        <span className={events.cardFacts}>
          <span>
            <Icon name="map-pin" size={14} />
            {[store.area, store.city].filter(Boolean).join(", ")}
          </span>
          <span className={shop.ratingFact} data-rated={store.rating.average !== null || undefined}>
            <Icon name="star" size={14} filled={store.rating.average !== null} />
            {ratingShort(store.rating)}
          </span>
        </span>
      </div>
    </Link>
  );
}
