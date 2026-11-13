import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui";
import {
  coverGradient,
  deliveryLine,
  fromLine,
  initialOf,
  placeLine,
  readyLine,
  shopSrcSet,
  type ShopCard as Card,
  type ShopPhoto,
} from "@/lib/api/shops";
import { ratingLine, ratingShort } from "@/lib/api/reviews";
import styles from "./shop.module.css";

interface CoverProps {
  photo: ShopPhoto | null;
  name: string;
  /** The `sizes` hint, so the browser picks a copy that is sharp but not oversized. */
  sizes: string;
  closed?: boolean;
  eager?: boolean;
  children?: ReactNode;
}

/** A shop's photo, or its initial on its own colours when it has none. */
export function ShopCover({ photo, name, sizes, closed, eager, children }: CoverProps) {
  return (
    <div className={styles.cover} data-closed={closed || undefined} style={photo ? undefined : { background: coverGradient(name) }}>
      {photo ? (
        <img src={photo.url} srcSet={shopSrcSet(photo)} sizes={sizes} alt={`${name} photo`} loading={eager ? "eager" : "lazy"} decoding="async" />
      ) : (
        <span className={styles.initial} aria-hidden>
          {initialOf(name)}
        </span>
      )}
      {children}
    </div>
  );
}

export const OpenPill = ({ open }: { open: boolean }) => (
  <span className={styles.pill} data-open={open || undefined}>
    {open ? "Open" : "Closed"}
  </span>
);

/** A print shop on Discover: a wide photo, then name, place, price and ready time. Same layout as the app. */
export function ShopCard({ shop, eager, index }: { shop: Card; eager?: boolean; index: number }) {
  const price = fromLine(shop);
  return (
    <Link href={`/b/${shop.id}`} className={styles.card} style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}>
      <ShopCover photo={shop.cover} name={shop.name} sizes="(max-width: 640px) 100vw, 340px" closed={!shop.open} eager={eager}>
        <OpenPill open={shop.open} />
      </ShopCover>
      <div className={styles.cardBody}>
        <div className={styles.nameRow}>
          <span className={styles.name}>{shop.name}</span>
          {price && <span className={styles.price}>{price}</span>}
        </div>
        <span className={styles.meta}>{[shop.typeLabel, placeLine(shop)].filter(Boolean).join(" · ")}</span>
        <span className={styles.facts}>
          <span aria-label={ratingLine(shop.rating)} data-rated={shop.rating.average !== null || undefined} className={styles.ratingFact}>
            <Icon name="star" size={14} filled={shop.rating.average !== null} /> {ratingShort(shop.rating)}
          </span>
          <span>
            <Icon name="clock" size={14} /> {readyLine(shop.turnaroundDays)}
          </span>
          <span>
            <Icon name="truck" size={14} /> {deliveryLine(shop)}
          </span>
        </span>
      </div>
    </Link>
  );
}

export const ShopCardSkeleton = () => <div className={styles.skeletonCard} aria-hidden />;
