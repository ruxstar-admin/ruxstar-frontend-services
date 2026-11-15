"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, ButtonLink, Icon, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useMe } from "@/components/social/session";
import { ListingReviews } from "@/components/reviews/ListingReviews";
import { PropertyPhoto } from "@/components/stays/PropertyCard";
import { BedDots, DotLegend, Fact } from "@/components/stays/pieces";
import { formError } from "@/lib/api/account";
import { ApiError } from "@/lib/api/client";
import { ratingLine, type Review } from "@/lib/api/reviews";
import { money } from "@/lib/api/shops";
import type { Page } from "@/lib/api/social";
import { availability, getProperty, type Availability, type PropertyDetail, type RoomView } from "@/lib/api/stays";
import {
  depositText,
  directionsUrl,
  FEATURE_LABEL,
  foodText,
  forText,
  istToday,
  KIND_LABEL,
  kmText,
  NEARBY_LABEL,
  noticeText,
  perText,
  plural,
  priceFromText,
  pricesText,
  ROOM_KIND_LABEL,
  rulesList,
} from "@/lib/stays";
import shop from "@/components/shop/shop.module.css";
import order from "@/components/shop/order.module.css";
import events from "@/components/events/events.module.css";
import styles from "@/components/stays/stays.module.css";

type Live = Availability["rooms"][number];

function RoomCard({ room, live, propertyId, canReserve }: { room: RoomView; live: Live | null | undefined; propertyId: string; canReserve: boolean }) {
  const paused = room.status === "paused";
  const beds = room.bedList.map((b) => ({ ...b, state: paused ? ("closed" as const) : live?.beds.find((x) => x.id === b.id)?.state }));
  const free = live ? live.beds.filter((b) => b.state === "free").length : null;
  const freeLine = paused
    ? "Full right now"
    : free === null
      ? null
      : room.kind === "private"
        ? free === room.beds
          ? "Free from today"
          : "Taken right now"
        : free === 0
          ? "No beds free from today"
          : `${free} of ${plural(room.beds, "bed")} free from today`;
  const reservable = canReserve && !paused && (live === undefined || live === null || live.bedTotal !== null || live.roomTotal !== null);
  return (
    <li className={styles.room} data-paused={paused || undefined}>
      <div className={styles.roomHead}>
        <span className={styles.roomName}>{room.name}</span>
        <Tag>{room.kind === "shared" ? `Shared · ${plural(room.beds, "bed")}` : ROOM_KIND_LABEL.private}</Tag>
      </div>
      <span className={styles.roomPrice}>{`${pricesText(room.prices)} ${perText(room.kind)}`}</span>
      {room.kind === "shared" && room.wholeRoom && <span className={order.faint}>You can also take the whole room.</span>}
      {room.features.length > 0 && <span className={order.small}>{room.features.map((f) => FEATURE_LABEL[f]).join(" · ")}</span>}
      <BedDots beds={beds} room={room.name} />
      {freeLine && <span className={order.small}>{freeLine}</span>}
      {reservable && (
        <div>
          <ButtonLink href={`/stays/${propertyId}/reserve?room=${room.id}`} variant="secondary">
            {room.kind === "private" ? "Reserve this room" : "Pick a bed"}
          </ButtonLink>
        </div>
      )}
    </li>
  );
}

/** Signed out, anyone can look and pick a bed; signing in and KYC come before paying. */
function PropertyView({ property, reviews }: { property: PropertyDetail; reviews: Page<Review> | null }) {
  const photos = property.photos.length ? property.photos : property.photo ? [property.photo] : [];
  const live = property.status === "live";
  const reservable = live && property.canReserve && property.rooms.some((r) => r.status === "live");
  const [now, setNow] = useState<Availability | null | undefined>(undefined);

  useEffect(() => {
    if (!reservable) return;
    let gone = false;
    const unit = property.units.includes("month") ? "month" : "night";
    availability(property.id, { moveIn: istToday(), stay: unit, ...(unit === "month" ? { months: 1 } : { nights: 1 }) }).then(
      (a) => !gone && setNow(a),
      () => !gone && setNow(null),
    );
    return () => {
      gone = true;
    };
  }, [property.id, property.units, reservable]);

  const action = (() => {
    if (!live) return null;
    if (!reservable) return <Button disabled>{property.whyNot ?? "Not taking reservations"}</Button>;
    return <ButtonLink href={`/stays/${property.id}/reserve`}>Reserve</ButtonLink>;
  })();
  const address = property.addressDetail;
  const rules = rulesList(property.rules);

  return (
    <div className={order.page}>
      {photos.length > 1 ? (
        <ul className={styles.gallery} aria-label="Photos">
          {photos.map((p, i) => (
            <li key={p.id}>
              <img src={p.url} width={p.width} height={p.height} alt={`Photo ${i + 1} of ${property.name}`} loading={i === 0 ? "eager" : "lazy"} decoding="async" />
            </li>
          ))}
        </ul>
      ) : (
        <PropertyPhoto photo={photos[0] ?? null} name={property.name} eager dimmed={!live} className={events.poster} />
      )}
      <div className={shop.head}>
        <div className={shop.tags}>
          <Tag>{KIND_LABEL[property.kind]}</Tag>
          <Tag>{forText(property.for, property.occupants)}</Tag>
        </div>
        <h1 className={events.eventTitle}>{property.name}</h1>
        <p className={events.byLine}>{`By ${property.business.name}`}</p>
      </div>

      {property.status === "removed" ? (
        <div className={order.news} role="status">
          <strong>Taken down</strong>
          <p className={order.small}>Ruxstar took this place down. It isn’t taking reservations.</p>
        </div>
      ) : property.status === "draft" ? (
        <div className={order.news} role="status">
          <strong>Draft</strong>
          <p className={order.small}>{property.whyNot ?? "This place isn’t published yet. Only you can see it."}</p>
        </div>
      ) : null}

      <div className={shop.panel}>
        <Fact icon="map-pin" title={address.line} detail={[address.area, address.city, address.pincode].filter(Boolean).join(", ")} />
        <Fact icon="home" title={foodText(property.food)} />
        <Fact
          icon="wallet"
          title={depositText(property.depositDetail.amount)}
          detail={property.depositDetail.amount > 0 ? (property.depositDetail.note ?? "You pay it to the owner when you move in, not on Ruxstar.") : null}
        />
        <Fact icon="clock" title={noticeText(property.noticeDays)} detail="Monthly stays run until you give notice." />
        <Fact icon="shield" title="Cancelling" detail={property.refundRule} />
        <Fact icon="verified" title="ID check before you reserve" detail="Ruxstar checks your identity once (KYC) before your first reservation." />
        {property.rating && property.rating.count > 0 && <Fact icon="star" title={ratingLine(property.rating)} detail={`Across ${property.business.name}’s places`} />}
        <a
          className={events.textLink}
          href={directionsUrl({ name: property.name, address: address.line, city: address.city, point: address.point })}
          target="_blank"
          rel="noreferrer"
        >
          Open in Google Maps
        </a>
      </div>

      <section className={order.section}>
        <h2 className={order.overline}>Rooms and prices</h2>
        {property.rooms.length ? (
          <>
            <DotLegend />
            <ul className={styles.rooms}>
              {property.rooms.map((r) => (
                <RoomCard
                  key={r.id}
                  room={r}
                  live={now === undefined ? undefined : (now?.rooms.find((x) => x.id === r.id) ?? null)}
                  propertyId={property.id}
                  canReserve={reservable}
                />
              ))}
            </ul>
          </>
        ) : (
          <p className={order.small}>No rooms yet. Check back soon.</p>
        )}
        {property.platformFee > 0 && <p className={order.faint}>{`Plus a ${money(property.platformFee)} platform fee on each reservation.`}</p>}
      </section>

      {property.facilities.length > 0 && (
        <section className={order.section}>
          <h2 className={order.overline}>Facilities</h2>
          <ul className={styles.pills}>
            {property.facilities.map((f) => (
              <li key={f.key}>
                <Icon name="check" size={14} />
                {f.name}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={order.section}>
        <h2 className={order.overline}>House rules</h2>
        <ul className={styles.pills}>
          {rules.map((r) => (
            <li key={r.text}>
              <Icon name={r.ok ? "check" : "close"} size={14} />
              {r.text}
            </li>
          ))}
        </ul>
        {property.rules.notes && <p className={shop.text}>{property.rules.notes}</p>}
      </section>

      {property.nearby.length > 0 && (
        <section className={order.section}>
          <h2 className={order.overline}>Nearby</h2>
          <ul className={styles.list}>
            {property.nearby.map((n) => (
              <li key={`${n.kind}-${n.name}`}>
                <span>{`${NEARBY_LABEL[n.kind]}: ${n.name}`}</span>
                <span>{kmText(n.km)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {property.description && (
        <section className={order.section}>
          <h2 className={order.overline}>About</h2>
          <p className={shop.text}>{property.description}</p>
        </section>
      )}

      {reviews && <ListingReviews module="stays" id={property.id} initial={reviews} />}

      {action && (
        <div className={shop.orderBar}>
          <span className={shop.orderText}>
            <strong>{priceFromText(property.priceFrom)}</strong>
            <span className={order.faint}>{[KIND_LABEL[property.kind], property.area, property.city].filter(Boolean).join(" · ")}</span>
          </span>
          {action}
        </div>
      )}
    </div>
  );
}

/**
 * One PG or hostel: photos, where, food, deposit, notice, rooms with their beds, facilities, rules, nearby places and
 * reviews. The page arrives from the server; free beds load here, and when you're signed in the property is fetched again
 * so its owner sees a draft.
 */
export function PropertyScreen({ id, initial, reviews }: { id: string; initial: PropertyDetail | null; reviews: Page<Review> | null }) {
  const me = useMe();
  const [full, setFull] = useState<PropertyDetail | null>(null);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(
    () =>
      getProperty(id).then(
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
    if (me === null) {
      if (!initial) void load();
      return;
    }
    void load();
    const onShow = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, [me, load, initial]);

  const property = full ?? initial;
  if (property) return <PropertyView property={property} reviews={reviews} />;
  if (error) {
    const gone = error instanceof ApiError && error.status === 404;
    return (
      <Empty title={gone ? "Place not found" : "Could not load this place"}>
        <p>{gone ? "It may have been taken down or the link is wrong." : formError(error).message}</p>
        {gone ? (
          <ButtonLink href="/discover?category=stays" variant="secondary">
            Find PGs and hostels
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
