"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, ButtonLink, Icon, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useMe } from "@/components/social/session";
import { CheckoutCoupons } from "@/components/coupons/CheckoutCoupons";
import { useOffers } from "@/components/coupons/use-offers";
import { useLoad } from "@/components/vendor/use-load";
import { BedDots, DotLegend, PriceLine, Stepper } from "@/components/stays/pieces";
import { formError } from "@/lib/api/account";
import { ApiError, keepIdempotencyKey, newIdempotencyKey } from "@/lib/api/client";
import { getKyc } from "@/lib/api/kyc";
import { money } from "@/lib/api/shops";
import {
  availability,
  getProperty,
  reserveRoom,
  staysRules,
  stayOffers,
  type AvailabilityRoom,
  type PropertyDetail,
  type RoomView,
  type StaysRulesView,
  type StayUnit,
} from "@/lib/api/stays";
import { addDays, dayShort, depositLine, FEATURE_LABEL, istToday, perText, plural, pricesText, ROOM_KIND_LABEL, unitsText } from "@/lib/stays";
import shop from "@/components/shop/shop.module.css";
import order from "@/components/shop/order.module.css";
import events from "@/components/events/events.module.css";
import styles from "@/components/stays/stays.module.css";

export interface ReservePick {
  room?: string;
  bed?: string;
  whole: boolean;
  from?: string;
  stay?: StayUnit;
  n?: number;
}

interface Choice {
  roomId: string;
  bedId: string | null;
  whole: boolean;
}

/** The bed or room picked, if it's still free for these dates, with its price for the stay. */
function priced(choice: Choice | null, rooms: AvailabilityRoom[]) {
  if (!choice) return null;
  const room = rooms.find((r) => r.id === choice.roomId);
  if (!room || room.status !== "live") return null;
  if (room.kind === "private" || choice.whole) return room.roomTotal !== null ? { room, items: room.roomTotal } : null;
  const bed = room.beds.find((b) => b.id === choice.bedId);
  return bed && bed.state === "free" && room.bedTotal !== null ? { room, bed, items: room.bedTotal } : null;
}

function RoomPick({
  room,
  view,
  live,
  choice,
  onChoose,
}: {
  room: AvailabilityRoom;
  view: RoomView | undefined;
  live: boolean;
  choice: Choice | null;
  onChoose: (c: Choice) => void;
}) {
  const mine = choice?.roomId === room.id;
  const paused = room.status === "paused";
  const free = room.beds.filter((b) => b.state === "free").length;
  const wholeOk = room.roomTotal !== null;
  return (
    <li id={`room-${room.id}`} className={styles.room} data-paused={paused || undefined} data-picked={mine || undefined}>
      <div className={styles.roomHead}>
        <span className={styles.roomName}>{room.name}</span>
        <Tag>{room.kind === "shared" ? `Shared · ${plural(room.beds.length, "bed")}` : ROOM_KIND_LABEL.private}</Tag>
      </div>
      {view && <span className={styles.roomPrice}>{`${pricesText(view.prices)} ${perText(room.kind)}`}</span>}
      {view && view.features.length > 0 && <span className={order.small}>{view.features.map((f) => FEATURE_LABEL[f]).join(" · ")}</span>}
      {room.kind === "shared" ? (
        <>
          <BedDots
            beds={room.beds}
            room={room.name}
            picked={mine && !choice?.whole ? choice?.bedId : null}
            onPick={live && room.bedTotal !== null ? (bedId) => onChoose({ roomId: room.id, bedId, whole: false }) : undefined}
          />
          <span className={order.small}>
            {paused
              ? "Full right now"
              : room.bedTotal === null
                ? free === 0
                  ? "No beds free for these dates"
                  : "Not let this way. Try the other stay type."
                : `${free} free · ${money(room.bedTotal)} a bed for this stay`}
          </span>
          {view?.wholeRoom && (
            <div>
              <button
                type="button"
                className={styles.whole}
                aria-pressed={mine && choice?.whole}
                disabled={!live || !wholeOk}
                onClick={() => onChoose({ roomId: room.id, bedId: null, whole: true })}
              >
                <Icon name="home" size={16} />
                {wholeOk ? `Whole room · ${money(room.roomTotal!)}` : "Whole room not free"}
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <BedDots beds={room.beds} room={room.name} />
          <div>
            <button
              type="button"
              className={styles.whole}
              aria-pressed={mine}
              disabled={!live || !wholeOk}
              onClick={() => onChoose({ roomId: room.id, bedId: null, whole: false })}
            >
              <Icon name={mine ? "check" : "home"} size={16} />
              {paused ? "Full right now" : wholeOk ? `This room · ${money(room.roomTotal!)}` : "Not free for these dates"}
            </button>
          </div>
        </>
      )}
    </li>
  );
}

function Reserve({ property, rules, pick }: { property: PropertyDetail; rules: StaysRulesView; pick: ReservePick }) {
  const router = useRouter();
  const me = useMe();
  const [today] = useState(() => istToday());
  const lastDay = addDays(today, rules.bookAheadDays);
  const units = property.units.length ? property.units : (["month"] as StayUnit[]);
  const usual: StayUnit = property.kind === "hostel" ? "night" : "month";
  const [unit, setUnit] = useState<StayUnit>(() => (pick.stay && units.includes(pick.stay) ? pick.stay : units.includes(usual) ? usual : units[0]!));
  const [moveIn, setMoveIn] = useState(() => (pick.from && pick.from >= today && pick.from <= lastDay ? pick.from : today));
  const maxN = unit === "month" ? rules.maxMonths : rules.maxNights;
  const [count, setCount] = useState(() => Math.min(pick.n ?? 1, maxN));
  const n = Math.min(Math.max(count, 1), maxN);
  const [choice, setChoice] = useState<Choice | null>(() =>
    pick.room ? { roomId: pick.room, bedId: pick.bed ?? null, whole: pick.whole } : null,
  );
  const [stage, setStage] = useState<"pick" | "pay">("pick");
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [kycOk, setKycOk] = useState<boolean | null>(null);
  const attempt = useRef<{ sig: string; key: string } | null>(null);
  const opening = useRef(pick.room ?? null);

  const sig = `${unit}|${moveIn}|${n}`;
  const free = useLoad(
    () => availability(property.id, { moveIn, stay: unit, ...(unit === "month" ? { months: n } : { nights: n }) }).then((a) => ({ sig, a })),
    sig,
  );
  const current = free.data?.sig === sig ? free.data.a : null;
  const picked = current ? priced(choice, current.rooms) : null;
  const lost = current !== null && choice !== null && !picked && (choice.bedId !== null || choice.whole || current.rooms.find((r) => r.id === choice.roomId)?.kind === "private");

  const reloadFree = free.reload;
  useEffect(() => {
    const onShow = () => document.visibilityState === "visible" && reloadFree();
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, [reloadFree]);

  // Scroll the room linked from the property page into view once its beds are drawn.
  useEffect(() => {
    if (!current || !opening.current) return;
    document.getElementById(`room-${opening.current}`)?.scrollIntoView({ block: "center" });
    opening.current = null;
  }, [current]);

  // Verification: the session says, and the KYC page is asked again whenever you come back to this tab.
  const approved = me ? me.kyc.base === "approved" : null;
  useEffect(() => {
    if (stage !== "pay" || !me || approved) return;
    let live = true;
    const check = () => getKyc().then((o) => live && setKycOk(o.base.status === "approved"), () => undefined);
    void check();
    const onShow = () => document.visibilityState === "visible" && void check();
    document.addEventListener("visibilitychange", onShow);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [stage, me, approved]);
  const verified = approved || kycOk === true;

  const body = {
    ...(choice?.bedId && !choice.whole ? { bedId: choice.bedId } : {}),
    ...(choice?.whole ? { whole: true } : {}),
    moveIn,
    stay: unit,
    ...(unit === "month" ? { months: n } : { nights: n }),
  };
  const bodySig = JSON.stringify([choice?.roomId, body]);
  const coupon = useOffers((code) => stayOffers(choice!.roomId, { ...body, ...(code ? { code } : {}) }), stage === "pay" && picked ? bodySig : null);
  const items = picked?.items ?? 0;
  const discount = Math.min(coupon.discount, items);
  const total = items - discount + property.platformFee;

  const here = () => {
    const q = new URLSearchParams({ from: moveIn, stay: unit, n: String(n) });
    if (choice) {
      q.set("room", choice.roomId);
      if (choice.bedId && !choice.whole) q.set("bed", choice.bedId);
      if (choice.whole) q.set("whole", "1");
    }
    return `/stays/${property.id}/reserve?${q.toString()}`;
  };

  const backToPick = () => {
    setStage("pick");
    setFailure(null);
  };
  const change = (fn: () => void) => {
    fn();
    backToPick();
  };

  const toPay = () => {
    if (!me) {
      router.push(`/signin?next=${encodeURIComponent(here())}`);
      return;
    }
    setStage("pay");
    setFailure(null);
    window.scrollTo({ top: 0 });
  };

  const place = async () => {
    if (!choice) return;
    setBusy(true);
    setFailure(null);
    if (attempt.current?.sig !== bodySig) attempt.current = { sig: bodySig, key: newIdempotencyKey() };
    try {
      const placed = await reserveRoom(
        choice.roomId,
        {
          ...body,
          ...(discount && coupon.applied ? { coupon: coupon.applied.code } : {}),
          returnTo: `${window.location.origin}/reservations`,
        },
        attempt.current.key,
      );
      window.location.assign(placed.checkoutUrl);
    } catch (err) {
      // A reservation that timed out may have been placed; the same key returns it instead of holding the bed twice.
      if (!keepIdempotencyKey(err)) attempt.current = null;
      if (err instanceof ApiError && err.code === "KYC_REQUIRED") {
        setKycOk(false);
      } else {
        setFailure(formError(err).message);
      }
      if (err instanceof ApiError && err.code === "CONFLICT") {
        free.reload();
        setStage("pick");
      }
      setBusy(false);
    }
  };

  const stayLine =
    unit === "month"
      ? `Moving in ${dayShort(moveIn)} · ${unitsText("month", n)} paid now`
      : `${dayShort(moveIn)} – ${dayShort(addDays(moveIn, n))} · ${unitsText("night", n)}`;
  const choiceLine = picked
    ? picked.room.kind === "private" || choice?.whole
      ? `${picked.room.name} · whole room`
      : `${picked.room.name} · bed ${picked.bed?.label}`
    : null;

  return (
    <div className={order.page}>
      <div className={shop.head}>
        <h1 className={order.title}>{property.name}</h1>
        <p className={order.small}>{[property.addressDetail.line, property.addressDetail.city].join(", ")}</p>
      </div>

      {stage === "pick" ? (
        <>
          <section className={order.section} aria-labelledby="when-title">
            <h2 id="when-title" className={order.overline}>
              When
            </h2>
            {units.length > 1 && (
              <div className={shop.chips} role="group" aria-label="Stay">
                {units.map((u) => (
                  <button
                    key={u}
                    type="button"
                    className={shop.subChip}
                    aria-pressed={unit === u}
                    onClick={() =>
                      change(() => {
                        setUnit(u);
                        setCount(1);
                      })
                    }
                  >
                    {u === "month" ? "By the month" : "By the night"}
                  </button>
                ))}
              </div>
            )}
            <div className={styles.stayRow}>
              <label className={styles.field}>
                Move-in date
                <input
                  type="date"
                  value={moveIn}
                  min={today}
                  max={lastDay}
                  required
                  onChange={(e) => {
                    const v = e.target.value;
                    if (/^\d{4}-\d{2}-\d{2}$/.test(v) && v >= today && v <= lastDay) change(() => setMoveIn(v));
                  }}
                />
              </label>
              {maxN > 1 && (
                <div className={styles.field}>
                  <span>{unit === "month" ? "Months to pay now" : "Nights"}</span>
                  <Stepper label={unit === "month" ? "months" : "nights"} value={n} min={1} max={maxN} onChange={(v) => change(() => setCount(v))} />
                </div>
              )}
            </div>
            <p className={order.faint}>
              {unit === "month"
                ? `You pay ${n === 1 ? "the first month" : `the first ${n} months`} here. You stay until you give ${plural(property.noticeDays, "day")}’ notice; rent after that is paid to the owner.`
                : `Check out on ${dayShort(addDays(moveIn, n))}.`}
            </p>
          </section>

          <section className={order.section} aria-labelledby="rooms-title">
            <h2 id="rooms-title" className={order.overline}>
              {property.rooms.some((r) => r.kind === "shared") ? "Pick a bed or a room" : "Pick a room"}
            </h2>
            <DotLegend picking />
            {free.error && !current ? (
              <div className={order.news} role="alert">
                <p className={order.small}>{formError(free.error).message}</p>
                <Button variant="secondary" onClick={free.reload}>
                  Try again
                </Button>
              </div>
            ) : !current ? (
              <div className={styles.rooms} aria-busy>
                <div className={shop.skeletonCard} />
              </div>
            ) : !current.reservable ? (
              <p className={order.small}>{`Reservations open ${rules.bookAheadDays} days ahead. Pick an earlier date.`}</p>
            ) : (
              <ul className={styles.rooms}>
                {current.rooms.map((r) => (
                  <RoomPick
                    key={r.id}
                    room={r}
                    view={property.rooms.find((x) => x.id === r.id)}
                    live={r.status === "live"}
                    choice={choice}
                    onChoose={(c) => change(() => setChoice(c))}
                  />
                ))}
              </ul>
            )}
            {lost && (
              <p className={order.error} role="alert">
                What you picked isn’t free for these dates. Pick another bed or room.
              </p>
            )}
          </section>
        </>
      ) : (
        <>
          <button type="button" className={events.textLink} onClick={backToPick}>
            ‹ Change room or dates
          </button>
          <div className={order.panel}>
            <strong>{choiceLine}</strong>
            <span className={order.small}>{stayLine}</span>
            <dl className={order.prices}>
              <PriceLine label={`Rent, ${unitsText(unit, n)}`} amount={items} />
              {discount > 0 && coupon.applied && <PriceLine label={`Coupon ${coupon.applied.code}`} amount={discount} minus />}
              {property.platformFee > 0 && <PriceLine label="Platform fee" amount={property.platformFee} />}
              <PriceLine label="Total" amount={total} strong />
            </dl>
            <span className={order.faint}>{depositLine(property.depositDetail)}</span>
          </div>

          {!verified ? (
            <div className={order.news} role="status">
              <strong>Verify your identity first</strong>
              <p className={order.small}>
                {kycOk === null && approved === false
                  ? "Checking your verification…"
                  : "PGs and hostels on Ruxstar only take verified tenants, so the owner knows who’s moving in. It takes a few minutes with DigiLocker, your PAN and a selfie. Your picks are kept, so you can come back here after."}
              </p>
              <div>
                <ButtonLink href={`/verify?next=${encodeURIComponent(here())}`}>Verify now</ButtonLink>
              </div>
            </div>
          ) : (
            <section className={order.section}>
              <h2 className={order.overline}>Coupon</h2>
              <CheckoutCoupons
                offers={coupon.offers}
                applied={coupon.applied}
                discount={discount}
                problem={coupon.problem}
                busy={coupon.busy}
                module="stays"
                onApply={(code) => void coupon.apply(code)}
                onRemove={coupon.remove}
              />
            </section>
          )}
          <div className={events.factRow}>
            <Icon name="shield" size={18} />
            <span>{property.refundRule}</span>
          </div>
          <p className={order.faint}>{`You’ll pay on Cashfree’s secure page. The ${choice?.whole || picked?.room.kind === "private" ? "room is" : "bed is"} held for ${rules.holdMinutes} minutes while you pay.`}</p>
        </>
      )}

      {failure && (
        <p className={order.error} role="alert">
          {failure}
        </p>
      )}

      <div className={shop.orderBar}>
        <span className={shop.orderText}>
          <strong>{picked ? `${choiceLine} · ${money(stage === "pay" ? total : items)}` : "Pick a bed or room"}</strong>
          <span className={order.faint}>{stayLine}</span>
        </span>
        {stage === "pick" ? (
          <Button disabled={!picked} onClick={toPay}>
            Continue
          </Button>
        ) : (
          <Button loading={busy} disabled={coupon.pricing || !picked || !verified} onClick={() => void place()}>
            {coupon.pricing ? "Working out the price…" : `Pay ${money(total)}`}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Reserving a PG or hostel: stay type, move-in date, months or nights, a bed or room, KYC, the coupon and Cashfree. */
export function ReserveScreen({ id, pick }: { id: string; pick: ReservePick }) {
  const property = useLoad(() => getProperty(id), id);
  const rules = useLoad(staysRules, "stays");
  const error = property.error ?? rules.error;
  if (property.data && rules.data) {
    const p = property.data;
    if (p.status !== "live" || !p.canReserve || !p.rooms.some((r) => r.status === "live")) {
      return (
        <Empty title={p.whyNot ?? "This place isn’t taking reservations right now."}>
          <p>Check the place’s page for its rooms and prices.</p>
          <ButtonLink href={`/stays/${id}`} variant="secondary">
            Back to the place
          </ButtonLink>
        </Empty>
      );
    }
    return <Reserve property={p} rules={rules.data} pick={pick} />;
  }
  if (error) {
    return (
      <Empty title={error instanceof ApiError && error.status === 404 ? "Place not found" : "Could not load this place"}>
        <p>{formError(error).message}</p>
        <Button
          variant="secondary"
          icon={<Icon name="refresh" size={16} />}
          onClick={() => {
            property.reload();
            rules.reload();
          }}
        >
          Try again
        </Button>
      </Empty>
    );
  }
  return (
    <div className={order.page} aria-busy>
      <div className={shop.skeletonCard} />
    </div>
  );
}
