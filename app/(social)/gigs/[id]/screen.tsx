"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, ButtonLink, Icon, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useMe } from "@/components/social/session";
import { ListingReviews } from "@/components/reviews/ListingReviews";
import { GigPhoto } from "@/components/gigs/GigCard";
import { FreelancerRow, PackagePicker } from "@/components/gigs/pieces";
import { formError } from "@/lib/api/account";
import { ApiError } from "@/lib/api/client";
import { getGig, type GigDetail, type GigTier } from "@/lib/api/gigs";
import type { Review } from "@/lib/api/reviews";
import { money } from "@/lib/api/shops";
import type { Page } from "@/lib/api/social";
import { pickPackage } from "@/lib/gigs";
import shop from "@/components/shop/shop.module.css";
import order from "@/components/shop/order.module.css";
import events from "@/components/events/events.module.css";
import stays from "@/components/stays/stays.module.css";

/** Signed out, anyone can look and pick a package; signing in comes before ordering. */
function GigView({ gig, reviews }: { gig: GigDetail; reviews: Page<Review> | null }) {
  const me = useMe();
  const [tier, setTier] = useState<GigTier>(() => pickPackage(gig.packages)?.tier ?? "basic");
  const picked = pickPackage(gig.packages, tier);
  const photos = gig.photos.length ? gig.photos : gig.photo ? [gig.photo] : [];
  const own = !!me && me.id === gig.freelancer.userId;

  return (
    <div className={order.page}>
      {photos.length > 1 ? (
        <ul className={stays.gallery} aria-label="Photos">
          {photos.map((p, i) => (
            <li key={p.id}>
              <img src={p.url} width={p.width} height={p.height} alt={`Photo ${i + 1} of ${gig.title}`} loading={i === 0 ? "eager" : "lazy"} decoding="async" />
            </li>
          ))}
        </ul>
      ) : (
        <GigPhoto photo={photos[0] ?? null} title={gig.title} eager dimmed={!gig.canOrder} className={events.poster} />
      )}
      <div className={shop.head}>
        <div className={shop.tags}>
          <Tag tone="solid">{gig.categoryLabel}</Tag>
        </div>
        <h1 className={events.eventTitle}>{gig.title}</h1>
      </div>

      {gig.status === "removed" ? (
        <div className={order.news} role="status">
          <p className={order.small}>Ruxstar took this gig down. It isn’t taking orders.</p>
        </div>
      ) : gig.status === "paused" ? (
        <div className={order.news} role="status">
          <p className={order.small}>The freelancer has paused this gig for now.</p>
        </div>
      ) : null}

      <FreelancerRow freelancer={gig.freelancer} rating={gig.rating} />

      <section className={order.section}>
        <h2 className={order.overline}>Packages</h2>
        <PackagePicker packages={gig.packages} tier={tier} onChange={setTier} />
        {gig.platformFee > 0 && <p className={order.faint}>{`Plus a ${money(gig.platformFee)} platform fee when you order.`}</p>}
        {gig.rules && <p className={order.faint}>{gig.rules}</p>}
      </section>

      <section className={order.section}>
        <h2 className={order.overline}>About this gig</h2>
        <p className={shop.text}>{gig.description}</p>
      </section>

      {reviews && <ListingReviews module="gigs" id={gig.id} initial={reviews} />}

      <div className={shop.orderBar}>
        <span className={shop.orderText}>
          <strong>{picked ? money(picked.price) : "No packages"}</strong>
          <span className={order.faint}>{picked ? picked.name : gig.categoryLabel}</span>
        </span>
        <div className={order.actions}>
          {!own && (
            <ButtonLink href={`/messages/with/${gig.freelancer.userId}`} variant="secondary" icon={<Icon name="chat" size={18} />}>
              Message the freelancer
            </ButtonLink>
          )}
          {gig.canOrder && picked ? (
            <ButtonLink href={`/gigs/${gig.id}/order?tier=${picked.tier}`}>{`Continue · ${money(picked.price)}`}</ButtonLink>
          ) : (
            <Button disabled>{gig.whyNot ?? "Not taking orders"}</Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * One gig: photos, the packages to compare, the freelancer, the rules, reviews, and ordering a package. The page
 * arrives from the server; when you're signed in the gig is fetched again so its freelancer sees a draft or a paused one.
 */
export function GigScreen({ id, initial, reviews }: { id: string; initial: GigDetail | null; reviews: Page<Review> | null }) {
  const me = useMe();
  const [full, setFull] = useState<GigDetail | null>(null);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(
    () =>
      getGig(id).then(
        (g) => {
          setFull(g);
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
    const onShow = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, [me, load, initial]);

  const gig = full ?? initial;
  if (gig) return <GigView gig={gig} reviews={reviews} />;
  if (error) {
    const gone = error instanceof ApiError && error.status === 404;
    return (
      <Empty title={gone ? "Gig not found" : "Could not load this gig"}>
        <p>{gone ? "It may have been taken down or the link is wrong." : formError(error).message}</p>
        {gone ? (
          <ButtonLink href="/discover?category=gigs" variant="secondary">
            Find a freelancer
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
