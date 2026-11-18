import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui";
import { Avatar } from "@/components/profile/Avatar";
import type { GigCard as Card, GigPhoto as Photo } from "@/lib/api/gigs";
import { ratingLine } from "@/lib/api/reviews";
import { coverGradient, initialOf } from "@/lib/api/shops";
import { cardPriceLine } from "@/lib/gigs";
import shop from "@/components/shop/shop.module.css";
import events from "@/components/events/events.module.css";
import styles from "./gigs.module.css";

/** A gig's photo at 16:9, or its initial on its own colours when there is none. */
export function GigPhoto({
  photo,
  title,
  eager,
  dimmed,
  className = shop.cover,
  children,
}: {
  photo: Photo | null;
  title: string;
  eager?: boolean;
  dimmed?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={className} data-closed={dimmed || undefined} style={photo ? undefined : { background: coverGradient(title) }}>
      {photo ? (
        <img src={photo.url} width={photo.width} height={photo.height} alt={`Photo of ${title}`} loading={eager ? "eager" : "lazy"} decoding="async" />
      ) : (
        <span className={shop.initial} aria-hidden>
          {initialOf(title)}
        </span>
      )}
      {children}
    </div>
  );
}

/** "4.5 (12)" once a gig has a rating, what it has so far before that, or null with no reviews. */
export const ratingText = (rating: Card["rating"]) =>
  rating?.average != null ? `${rating.average.toFixed(1)} (${rating.count})` : rating?.count ? ratingLine(rating) : null;

/** A gig on Discover or a freelancer's page: the photo, the title, who and where, the rating and the starting price. */
export function GigCard({ gig, eager, index, hideFreelancer }: { gig: Card; eager?: boolean; index: number; hideFreelancer?: boolean }) {
  const rating = ratingText(gig.rating);
  return (
    <Link href={`/gigs/${gig.id}`} className={shop.card} style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}>
      <GigPhoto photo={gig.photo} title={gig.title} eager={eager}>
        <span className={styles.categoryPill}>{gig.categoryLabel}</span>
      </GigPhoto>
      <div className={shop.cardBody}>
        {!hideFreelancer && (
          <span className={styles.who}>
            <Avatar name={gig.freelancer.name} url={gig.freelancer.avatarUrl} size={24} />
            <span>{[gig.freelancer.name, gig.freelancer.city].filter(Boolean).join(" · ")}</span>
          </span>
        )}
        <span className={events.cardTitle}>{gig.title}</span>
        <span className={events.cardFacts}>
          {rating && (
            <span className={shop.ratingFact} data-rated>
              <Icon name="star" size={14} filled />
              {rating}
            </span>
          )}
          <span className={events.cardPrice}>{cardPriceLine(gig)}</span>
        </span>
      </div>
    </Link>
  );
}
