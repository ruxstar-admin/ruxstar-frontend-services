"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, ButtonLink, Icon, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useMe } from "@/components/social/session";
import { ListingReviews } from "@/components/reviews/ListingReviews";
import { GroundPhoto } from "@/components/turf/GroundCard";
import { formError } from "@/lib/api/account";
import { ApiError } from "@/lib/api/client";
import { ratingLine, type Review } from "@/lib/api/reviews";
import { money } from "@/lib/api/shops";
import type { Page } from "@/lib/api/social";
import { getGround, type CourtView, type GroundDetail } from "@/lib/api/turf";
import { AMENITY_LABEL, directionsUrl, hoursText, PER_LABEL, priceFromText, pricesText, slotLengthText } from "@/lib/turf";
import shop from "@/components/shop/shop.module.css";
import order from "@/components/shop/order.module.css";
import events from "@/components/events/events.module.css";
import styles from "@/components/turf/turf.module.css";

function Fact({ icon, title, detail }: { icon: "map-pin" | "shield" | "star" | "clock"; title: string; detail?: string | null }) {
  return (
    <div className={events.factRow}>
      <Icon name={icon} size={18} />
      <span className={events.factText}>
        <strong>{title}</strong>
        {detail && <span className={order.small}>{detail}</span>}
      </span>
    </div>
  );
}

function CourtCard({ court, groundId, canBook }: { court: CourtView; groundId: string; canBook: boolean }) {
  const paused = court.status === "paused";
  return (
    <li className={styles.court} data-paused={paused || undefined}>
      <div className={styles.courtHead}>
        <span className={styles.courtName}>{court.name}</span>
        {paused ? <Tag>Not taking bookings</Tag> : <Tag>{slotLengthText(court.slotMinutes)} slots</Tag>}
      </div>
      <span className={order.small}>{court.sports.map((s) => s.name).join(", ")}</span>
      <span className={order.small}>{hoursText(court.hours)}</span>
      <span className={order.small}>{pricesText(court.prices, court.slotMinutes)}</span>
      {court.addOns.length > 0 && (
        <span className={order.faint}>{`Add-ons: ${court.addOns.map((a) => `${a.name} ${money(a.price)} ${PER_LABEL[a.per]}`).join(" · ")}`}</span>
      )}
      {canBook && !paused && (
        <div>
          <ButtonLink href={`/grounds/${groundId}/book?court=${court.id}`} variant="secondary">
            See free slots
          </ButtonLink>
        </div>
      )}
    </li>
  );
}

/** Signed out, anyone can look at free slots; signing in comes before paying. */
function GroundView({ ground, reviews }: { ground: GroundDetail; reviews: Page<Review> | null }) {
  const photos = ground.photos.length ? ground.photos : ground.photo ? [ground.photo] : [];
  const live = ground.status === "live";
  const bookable = live && ground.canBook && ground.courtList.some((c) => c.status === "live");

  const action = (() => {
    if (!live) return null;
    if (!bookable) return <Button disabled>{ground.whyNot ?? "Not taking bookings"}</Button>;
    return <ButtonLink href={`/grounds/${ground.id}/book`}>Book a slot</ButtonLink>;
  })();

  return (
    <div className={order.page}>
      {photos.length > 1 ? (
        <ul className={styles.gallery} aria-label="Photos">
          {photos.map((p, i) => (
            <li key={p.id}>
              <img src={p.url} width={p.width} height={p.height} alt={`Photo ${i + 1} of ${ground.name}`} loading={i === 0 ? "eager" : "lazy"} decoding="async" />
            </li>
          ))}
        </ul>
      ) : (
        <GroundPhoto photo={photos[0] ?? null} name={ground.name} eager dimmed={!live} className={events.poster} />
      )}
      <div className={shop.head}>
        {ground.sports.length > 0 && (
          <div className={shop.tags}>
            {ground.sports.map((s) => (
              <Tag key={s.key}>{s.name}</Tag>
            ))}
          </div>
        )}
        <h1 className={events.eventTitle}>{ground.name}</h1>
        <p className={events.byLine}>{`By ${ground.business.name}`}</p>
      </div>

      {ground.status === "removed" ? (
        <div className={order.news} role="status">
          <strong>Taken down</strong>
          <p className={order.small}>Ruxstar took this ground down. It isn’t taking bookings.</p>
        </div>
      ) : ground.status === "draft" ? (
        <div className={order.news} role="status">
          <strong>Draft</strong>
          <p className={order.small}>{ground.whyNot ?? "This ground isn’t published yet. Only you can see it."}</p>
        </div>
      ) : null}

      <div className={shop.panel}>
        <Fact icon="map-pin" title={ground.venue.address} detail={[ground.venue.city, ground.venue.pincode].filter(Boolean).join(" ")} />
        <Fact icon="shield" title="Cancelling" detail={ground.refundRule} />
        {ground.rating && ground.rating.count > 0 && <Fact icon="star" title={ratingLine(ground.rating)} detail={`Across ${ground.business.name}’s grounds`} />}
        <a className={events.textLink} href={directionsUrl({ name: ground.name, address: ground.venue.address, city: ground.venue.city, point: ground.venue.point })} target="_blank" rel="noreferrer">
          Get directions
        </a>
      </div>

      {ground.amenities.length > 0 && (
        <section className={order.section}>
          <h2 className={order.overline}>At the ground</h2>
          <ul className={styles.amenities}>
            {ground.amenities.map((a) => (
              <li key={a}>
                <Icon name="check" size={14} />
                {AMENITY_LABEL[a]}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={order.section}>
        <h2 className={order.overline}>Courts and prices</h2>
        {ground.courtList.length ? (
          <ul className={styles.courts}>
            {ground.courtList.map((c) => (
              <CourtCard key={c.id} court={c} groundId={ground.id} canBook={bookable} />
            ))}
          </ul>
        ) : (
          <p className={order.small}>No courts yet. Check back soon.</p>
        )}
        {ground.platformFee > 0 && <p className={order.faint}>{`Plus a ${money(ground.platformFee)} platform fee on each booking.`}</p>}
      </section>

      {ground.description && (
        <section className={order.section}>
          <h2 className={order.overline}>About</h2>
          <p className={shop.text}>{ground.description}</p>
        </section>
      )}

      {reviews && <ListingReviews module="turf" id={ground.id} initial={reviews} />}

      {action && (
        <div className={shop.orderBar}>
          <span className={shop.orderText}>
            <strong>{priceFromText(ground.priceFrom)}</strong>
            <span className={order.faint}>{`${ground.courts} ${ground.courts === 1 ? "court" : "courts"} · ${ground.city}`}</span>
          </span>
          {action}
        </div>
      )}
    </div>
  );
}

/**
 * One ground: photos, where, amenities, courts with their prices, refunds and reviews. The page arrives from the server
 * with the ground and its first reviews; when you're signed in it is fetched again here, so its owner sees a draft and
 * everyone sees whether it is taking bookings right now. Same as the app.
 */
export function GroundScreen({ id, initial, reviews }: { id: string; initial: GroundDetail | null; reviews: Page<Review> | null }) {
  const me = useMe();
  const [full, setFull] = useState<GroundDetail | null>(null);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(
    () =>
      getGround(id).then(
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

  const ground = full ?? initial;
  if (ground) return <GroundView ground={ground} reviews={reviews} />;
  if (error) {
    const gone = error instanceof ApiError && error.status === 404;
    return (
      <Empty title={gone ? "Ground not found" : "Could not load this ground"}>
        <p>{gone ? "It may have been taken down or the link is wrong." : formError(error).message}</p>
        {gone ? (
          <ButtonLink href="/discover?category=turf" variant="secondary">
            Find grounds
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
