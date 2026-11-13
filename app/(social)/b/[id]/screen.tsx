"use client";

import { useEffect, useState } from "react";
import { Button, ButtonLink, Icon, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useBack } from "@/components/social/Shell";
import { useOnSignedOut } from "@/components/social/session";
import { ReviewCard } from "@/components/reviews/Reviews";
import { ShopCover } from "@/components/shop/ShopCard";
import { ApiError } from "@/lib/api/client";
import { ratingLine, shopReviews, type Review } from "@/lib/api/reviews";
import {
  deliveryLine,
  fromLine,
  getShop,
  money,
  OPTION_LABELS,
  placeLine,
  productPrice,
  readyLine,
  type Shop,
  type ShopProduct,
} from "@/lib/api/shops";
import social from "@/components/social/social.module.css";
import styles from "@/components/shop/shop.module.css";

function Product({ product, shopDays }: { product: ShopProduct; shopDays: number }) {
  const unit = product.pricing === "per_page" ? "a page" : "each";
  const lines = [
    product.minQuantity > 1 ? `Minimum ${product.minQuantity}` : null,
    product.turnaroundDays !== shopDays ? readyLine(product.turnaroundDays) : null,
  ].filter(Boolean);

  return (
    <div className={styles.product}>
      <div className={styles.productHead}>
        <span>{product.label}</span>
        <span>{productPrice(product)}</span>
      </div>
      {product.description && <p className={styles.small}>{product.description}</p>}
      {lines.length > 0 && <p className={styles.small}>{lines.join(" · ")}</p>}
      {(product.tiers.length > 0 || product.extras.length > 0) && (
        <div className={styles.tags}>
          {product.tiers.map((t) => (
            <Tag key={t.from} tone="success">
              {t.from}+ at {money(t.unitPrice)} {unit}
            </Tag>
          ))}
          {product.extras.map((x) => (
            <Tag key={`${x.option}-${x.value}`}>
              {x.value} +{money(x.price)}
            </Tag>
          ))}
        </div>
      )}
      {product.options.length > 0 && (
        <p className={styles.faint}>Choose {product.options.map((o) => (OPTION_LABELS[o.option] ?? o.option).toLowerCase()).join(", ")}</p>
      )}
    </div>
  );
}

const PREVIEW_REVIEWS = 3;

/** The newest few reviews, and the way to all of them. */
function ReviewsPreview({ shop }: { shop: Shop }) {
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    let live = true;
    shopReviews(shop.id).then(
      (page) => live && setReviews(page.items.slice(0, PREVIEW_REVIEWS)),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [shop.id]);

  return (
    <section className={styles.section}>
      <h2 className={styles.overline}>Reviews</h2>
      {reviews.map((r) => (
        <ReviewCard key={r.id} review={r} />
      ))}
      {shop.rating.count > reviews.length && (
        <ButtonLink variant="secondary" href={`/b/${shop.id}/reviews`}>
          {`See all ${shop.rating.count} reviews`}
        </ButtonLink>
      )}
    </section>
  );
}

function ShopView({ shop }: { shop: Shop }) {
  const back = useBack();
  const price = fromLine(shop);
  const photos = shop.photos.length ? shop.photos : [null];
  const place = [placeLine(shop), shop.pincode].filter(Boolean).join(" ");

  return (
    <div className={styles.shop}>
      <button type="button" className={social.back} onClick={back}>
        <Icon name="arrow-left" size={18} /> Back
      </button>

      <div className={styles.gallery} aria-label={`${shop.name} photos`}>
        {photos.map((photo, i) => (
          <ShopCover key={photo?.url ?? "none"} photo={photo} name={shop.name} sizes="(max-width: 800px) 100vw, 760px" eager={i === 0} />
        ))}
      </div>
      {shop.photos.length > 1 && <span className={styles.galleryCount}>{shop.photos.length} photos · scroll to see more</span>}

      <div>
        <h1 className={styles.shopTitle}>
          {shop.name} <Tag tone={shop.open ? "success" : "neutral"}>{shop.open ? "Open" : "Closed"}</Tag>
        </h1>
        <p className={styles.small}>{[shop.typeLabel, place].filter(Boolean).join(" · ")}</p>
      </div>

      <div className={styles.panel}>
        <span className={styles.fact}>
          <Icon name="star" size={18} /> {ratingLine(shop.rating)}
        </span>
        <span className={styles.fact}>
          <Icon name="clock" size={18} /> {readyLine(shop.turnaroundDays)}
        </span>
        <span className={styles.fact}>
          <Icon name="truck" size={18} /> {deliveryLine(shop)}
        </span>
        {shop.minOrder > 0 && (
          <span className={styles.fact}>
            <Icon name="wallet" size={18} /> Minimum order {money(shop.minOrder)}
          </span>
        )}
      </div>

      {shop.description && (
        <section className={styles.section}>
          <h2 className={styles.overline}>About</h2>
          <p className={styles.text}>{shop.description}</p>
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.overline}>What they print</h2>
        {shop.catalog.map((p) => (
          <Product key={p.id} product={p} shopDays={shop.turnaroundDays} />
        ))}
      </section>

      {shop.notes && (
        <section className={styles.section}>
          <h2 className={styles.overline}>From the shop</h2>
          <p className={styles.text}>{shop.notes}</p>
        </section>
      )}

      {shop.rating.count > 0 && <ReviewsPreview shop={shop} />}

      <div className={styles.orderBar}>
        <span className={styles.orderText}>
          {price && <strong>{price}</strong>}
          <span className={styles.faint}>{shop.open ? readyLine(shop.turnaroundDays) : "Closed right now"}</span>
        </span>
        {shop.open && shop.catalog.length > 0 ? (
          <ButtonLink size="lg" href={`/b/${shop.id}/order`}>
            Order
          </ButtonLink>
        ) : (
          <Button size="lg" disabled>
            {shop.open ? "Order" : "Closed"}
          </Button>
        )}
      </div>
    </div>
  );
}

/** A print shop's public page: photos, what it prints and for how much, and the Order button. Same as the app. */
export function ShopScreen({ id }: { id: string }) {
  const onSignedOut = useOnSignedOut();
  const [shop, setShop] = useState<Shop | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    getShop(id).then(
      (s) => live && setShop(s),
      (err) => live && !onSignedOut(err) && setError(err),
    );
    return () => {
      live = false;
    };
  }, [id, attempt, onSignedOut]);

  if (shop) return <ShopView shop={shop} />;
  if (error) {
    const gone = error instanceof ApiError && error.status === 404;
    return (
      <Empty title={gone ? "Shop not available" : "Could not load this shop"}>
        <p>{gone ? error.message : "Check your connection and try again."}</p>
        {gone ? (
          <ButtonLink href="/discover" variant="secondary">
            Back to Discover
          </ButtonLink>
        ) : (
          <Button
            variant="secondary"
            onClick={() => {
              setError(null);
              setAttempt((n) => n + 1);
            }}
          >
            Try again
          </Button>
        )}
      </Empty>
    );
  }
  return (
    <div className={styles.shop} aria-busy>
      <div className={styles.skeletonCard} />
    </div>
  );
}
