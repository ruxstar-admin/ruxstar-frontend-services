"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, ButtonLink, Icon, Switch } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useMe } from "@/components/social/session";
import { CheckoutCoupons } from "@/components/coupons/CheckoutCoupons";
import { useOffers } from "@/components/coupons/use-offers";
import { useLoad } from "@/components/vendor/use-load";
import { DateStrip, Legend, PriceLine, SlotGrid, Stepper } from "@/components/turf/booking";
import { formError } from "@/lib/api/account";
import { ApiError, keepIdempotencyKey, newIdempotencyKey } from "@/lib/api/client";
import { money } from "@/lib/api/shops";
import { bookCourt, bookingOffers, courtSlots, getGround, turfRules, type AddOnPick, type GroundDetail, type TurfRulesView } from "@/lib/api/turf";
import {
  addDays,
  addOnsCost,
  closedWeekdays,
  DAY_LONG,
  dayShort,
  GROUND_CANCELS,
  keepSelection,
  PER_LABEL,
  selectionSummary,
  stripDays,
  toggleSlot,
  weekdayOf,
  weeksLater,
  weeksText,
  type PickSlot,
} from "@/lib/turf";
import shop from "@/components/shop/shop.module.css";
import order from "@/components/shop/order.module.css";
import events from "@/components/events/events.module.css";
import styles from "@/components/turf/turf.module.css";

const STRIP_DAYS = 14;
/** "Only 2 slots left" once this few are free on the day. */
const FEW_LEFT = 2;

type Check = { day: string; ok: boolean | null };

/** Whether the same slots are free each later week of a repeat: one call per week, only while repeating. */
function useRepeatCheck(courtId: string, day: string, starts: string[], weeks: number) {
  const key = weeks > 1 && starts.length ? `${courtId}|${starts.join(",")}|${weeks}` : null;
  const [result, setResult] = useState<{ key: string; dates: Check[] } | null>(null);
  const startsRef = useRef(starts);
  startsRef.current = starts;

  useEffect(() => {
    if (!key) return;
    let live = true;
    const picked = startsRef.current;
    const later = Array.from({ length: weeks - 1 }, (_, i) => i + 1);
    void Promise.all(
      later.map((k) =>
        courtSlots(courtId, addDays(day, 7 * k)).then(
          (ds): Check => ({
            day: ds.date,
            ok: picked.every((start) => ds.slots.some((s) => Date.parse(s.startAt) === Date.parse(weeksLater(start, k)) && s.state === "free")),
          }),
          (): Check => ({ day: addDays(day, 7 * k), ok: null }),
        ),
      ),
    ).then((dates) => live && setResult({ key, dates }));
    return () => {
      live = false;
    };
  }, [key, courtId, day, weeks]);

  if (!key) return { checking: false, dates: [] as Check[] };
  return result?.key === key ? { checking: false, dates: result.dates } : { checking: true, dates: [] as Check[] };
}

function Booking({ ground, rules, initialCourt, initialDay }: { ground: GroundDetail; rules: TurfRulesView; initialCourt?: string; initialDay?: string }) {
  const router = useRouter();
  const me = useMe();
  const courts = ground.courtList.filter((c) => c.status === "live");
  const [courtId, setCourtId] = useState(() => courts.find((c) => c.id === initialCourt)?.id ?? courts[0]!.id);
  const court = courts.find((c) => c.id === courtId) ?? courts[0]!;
  const [now] = useState(() => Date.now());
  const days = useMemo(() => stripDays(Math.min(STRIP_DAYS, rules.bookAheadDays + 1), now, closedWeekdays(court)), [now, court, rules.bookAheadDays]);
  const [day, setDay] = useState(() => days.find((d) => d.key === initialDay)?.key ?? days.find((d) => !d.closed)?.key ?? days[0]!.key);
  const [chosen, setChosen] = useState<string[]>([]);
  const [sport, setSport] = useState<string | null>(court.sports[0]?.key ?? null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [repeat, setRepeat] = useState(false);
  const [weekCount, setWeekCount] = useState(Math.min(4, rules.maxRepeatWeeks));
  const [stage, setStage] = useState<"pick" | "pay">("pick");
  const [note, setNote] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const attempt = useRef<{ sig: string; key: string } | null>(null);

  const daySlots = useLoad(() => courtSlots(court.id, day), `${court.id}|${day}`);
  const current = daySlots.data && daySlots.data.court.id === court.id && daySlots.data.date === day ? daySlots.data : null;
  const slots = useMemo<PickSlot[]>(
    () => (current?.slots ?? []).map((s) => ({ key: s.startAt, start: s.start, end: s.end, price: s.price, state: s.state === "free" ? (s.peak ? "peak" : "free") : s.state })),
    [current],
  );
  const selected = keepSelection(slots, chosen);
  const lost = current !== null && chosen.length > selected.length;
  const summary = selectionSummary(slots, selected);
  const freeLeft = slots.filter((s) => s.state === "free" || s.state === "peak").length;

  const reloadSlots = daySlots.reload;
  useEffect(() => {
    const onShow = () => document.visibilityState === "visible" && reloadSlots();
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, [reloadSlots]);

  const weeks = repeat ? weekCount : 1;
  const picks: AddOnPick[] = court.addOns.filter((a) => (quantities[a.id] ?? 0) > 0).map((a) => ({ id: a.id, quantity: quantities[a.id]! }));
  const perDate = summary.total + addOnsCost(court.addOns, quantities, summary.count);
  const items = perDate * weeks;
  const check = useRepeatCheck(court.id, day, selected, weeks);
  // A week that couldn't be checked doesn't stop paying: booking checks every date again.
  const repeatOk = weeks === 1 || (!check.checking && check.dates.every((d) => d.ok !== false));

  const body = { startAts: selected, ...(picks.length ? { addOns: picks } : {}), ...(weeks > 1 ? { weeks } : {}) };
  const sig = JSON.stringify(body);
  const coupon = useOffers((code) => bookingOffers(court.id, { ...body, ...(code ? { code } : {}) }), stage === "pay" && summary.count ? sig : null);
  const discount = Math.min(coupon.discount, items);
  const total = items - discount + ground.platformFee;

  const reset = () => {
    setChosen([]);
    setStage("pick");
    setNote(null);
    setFailure(null);
  };
  const pickCourt = (id: string) => {
    if (id === court.id) return;
    const next = courts.find((c) => c.id === id)!;
    setCourtId(id);
    setSport(next.sports[0]?.key ?? null);
    setQuantities({});
    reset();
  };
  const pickDay = (key: string) => {
    setDay(key);
    reset();
  };
  const onPick = (key: string) => {
    const next = toggleSlot(slots, selected, key);
    if (next.length > rules.maxSlots) {
      setNote(`Book up to ${rules.maxSlots} slots at a time.`);
      return;
    }
    setNote(null);
    setChosen(next);
    setStage("pick");
  };

  const toPay = () => {
    if (!me) {
      router.push(`/signin?next=${encodeURIComponent(`/grounds/${ground.id}/book?court=${court.id}&date=${day}`)}`);
      return;
    }
    setStage("pay");
    setFailure(null);
    window.scrollTo({ top: 0 });
  };

  const place = async () => {
    setBusy(true);
    setFailure(null);
    if (attempt.current?.sig !== sig) attempt.current = { sig, key: newIdempotencyKey() };
    try {
      const placed = await bookCourt(
        court.id,
        {
          ...body,
          ...(sport && court.sports.length > 1 ? { sport } : {}),
          ...(discount && coupon.applied ? { coupon: coupon.applied.code } : {}),
          returnTo: `${window.location.origin}/bookings`,
        },
        attempt.current.key,
      );
      if (placed.checkoutUrl) window.location.assign(placed.checkoutUrl);
      else router.replace(`/bookings/${placed.booking.id}?fresh=1`);
    } catch (err) {
      setFailure(formError(err).message);
      // A booking that timed out may have been placed; the same key returns it instead of holding the slots twice.
      if (!keepIdempotencyKey(err)) attempt.current = null;
      if (err instanceof ApiError && err.code === "CONFLICT") {
        daySlots.reload();
        setStage("pick");
      }
      setBusy(false);
    }
  };

  const weekday = DAY_LONG[weekdayOf(day)];

  return (
    <div className={order.page}>
      <div className={shop.head}>
        <h1 className={order.title}>{ground.name}</h1>
        <p className={order.small}>{`${ground.venue.address}, ${ground.venue.city}`}</p>
      </div>

      {stage === "pick" ? (
        <>
          {courts.length > 1 && (
            <div className={shop.chips} role="group" aria-label="Court">
              {courts.map((c) => (
                <button key={c.id} type="button" className={shop.subChip} aria-pressed={c.id === court.id} onClick={() => pickCourt(c.id)}>
                  {`${c.name} · ${c.sports.map((s) => s.name).join(", ")}`}
                </button>
              ))}
            </div>
          )}

          <DateStrip days={days} value={day} onChange={pickDay} />

          <section className={order.section} aria-labelledby="slots-title">
            <div className={order.titleRow}>
              <h2 id="slots-title" className={order.overline}>
                {`${court.name} · ${dayShort(day)}`}
              </h2>
            </div>
            {current && current.open && freeLeft > 0 && freeLeft <= FEW_LEFT && (
              <p className={order.small} role="status">
                <Icon name="alert" size={14} /> {`Few left: only ${freeLeft} ${freeLeft === 1 ? "slot" : "slots"} free on this day.`}
              </p>
            )}
            {daySlots.error && !current ? (
              <div className={order.news} role="alert">
                <p className={order.small}>{formError(daySlots.error).message}</p>
                <Button variant="secondary" onClick={daySlots.reload}>
                  Try again
                </Button>
              </div>
            ) : !current ? (
              <div className={styles.slots} aria-busy>
                <div className={shop.skeletonCard} />
              </div>
            ) : !current.open ? (
              <p className={order.small}>{`${court.name} is closed on ${weekday}s. Try another date.`}</p>
            ) : !current.bookable ? (
              <p className={order.small}>{`Bookings open ${rules.bookAheadDays} days ahead. Pick an earlier date.`}</p>
            ) : (
              <SlotGrid slots={slots} selected={selected} onPick={onPick} />
            )}
            <Legend states={["free", "peak", "selected", "booked", "blocked"]} />
            {lost && (
              <p className={order.error} role="alert">
                Someone just booked one of your slots. Pick another time.
              </p>
            )}
            {note && (
              <p className={order.small} role="status">
                {note}
              </p>
            )}
          </section>

          {court.sports.length > 1 && (
            <section className={order.section}>
              <h2 className={order.overline}>Sport</h2>
              <div className={shop.chips} role="radiogroup" aria-label="Sport">
                {court.sports.map((s) => (
                  <button key={s.key} type="button" role="radio" className={shop.subChip} aria-checked={sport === s.key} aria-pressed={sport === s.key} onClick={() => setSport(s.key)}>
                    {s.name}
                  </button>
                ))}
              </div>
            </section>
          )}

          {court.addOns.length > 0 && (
            <section className={order.section}>
              <h2 className={order.overline}>Add-ons</h2>
              <ul className={styles.addOns}>
                {court.addOns.map((a) => (
                  <li key={a.id}>
                    <span className={styles.addOnText}>
                      <strong>{a.name}</strong>
                      <span className={order.small}>{`${money(a.price)} ${PER_LABEL[a.per]}`}</span>
                    </span>
                    <Stepper
                      label={a.name}
                      value={quantities[a.id] ?? 0}
                      min={0}
                      max={20}
                      onChange={(n) => {
                        setQuantities((q) => ({ ...q, [a.id]: n }));
                        setStage("pick");
                      }}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {rules.maxRepeatWeeks > 1 && (
            <section className={order.section}>
              <h2 className={order.overline}>Repeat</h2>
              <Switch checked={repeat} onChange={setRepeat} description={`The same slots every ${weekday}, all paid now. Up to ${weeksText(rules.maxRepeatWeeks)}.`}>
                Repeat weekly
              </Switch>
              {repeat && (
                <div className={order.panel}>
                  <div className={order.titleRow}>
                    <span className={order.small}>Weeks, this one included</span>
                    <Stepper label="weeks" value={weekCount} min={2} max={rules.maxRepeatWeeks} onChange={setWeekCount} />
                  </div>
                  {summary.count === 0 ? (
                    <p className={order.faint}>Pick slots to see the dates.</p>
                  ) : (
                    <ul className={styles.dates} aria-live="polite" aria-busy={check.checking || undefined}>
                      <li data-ok="true">
                        <Icon name="check" size={16} />
                        {`${dayShort(day)} · free`}
                      </li>
                      {check.checking ? (
                        <li>Checking the other weeks…</li>
                      ) : (
                        check.dates.map((d) => (
                          <li key={d.day} data-ok={d.ok === null ? undefined : String(d.ok)}>
                            <Icon name={d.ok ? "check" : d.ok === false ? "close" : "alert"} size={16} />
                            {`${dayShort(d.day)} · ${d.ok ? "free" : d.ok === false ? "not free" : "couldn’t check"}`}
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                  {!check.checking && check.dates.some((d) => d.ok === false) && (
                    <p className={order.small} role="alert">
                      Every date has to be free. Pick other slots, or fewer weeks.
                    </p>
                  )}
                </div>
              )}
            </section>
          )}
        </>
      ) : (
        <>
          <button type="button" className={events.textLink} onClick={() => setStage("pick")}>
            ‹ Change slots
          </button>
          <div className={order.panel}>
            <strong>{`${court.name} · ${summary.text}`}</strong>
            <span className={order.small}>{weeks > 1 ? `Every ${weekday} for ${weeksText(weeks)}, from ${dayShort(day)}` : dayShort(day)}</span>
            {picks.length > 0 && <span className={order.faint}>{picks.map((p) => `${p.quantity} × ${court.addOns.find((a) => a.id === p.id)?.name}`).join(", ")}</span>}
            <dl className={order.prices}>
              <PriceLine label={weeks > 1 ? `Slots, ${weeksText(weeks)}` : "Slots"} amount={summary.total * weeks} />
              {perDate > summary.total && <PriceLine label="Add-ons" amount={(perDate - summary.total) * weeks} />}
              {discount > 0 && coupon.applied && <PriceLine label={`Coupon ${coupon.applied.code}`} amount={discount} minus />}
              {ground.platformFee > 0 && <PriceLine label="Platform fee" amount={ground.platformFee} />}
              <PriceLine label="Total" amount={total} strong />
            </dl>
          </div>
          <section className={order.section}>
            <h2 className={order.overline}>Coupon</h2>
            <CheckoutCoupons
              offers={coupon.offers}
              applied={coupon.applied}
              discount={discount}
              problem={coupon.problem}
              busy={coupon.busy}
              module="turf"
              onApply={(code) => void coupon.apply(code)}
              onRemove={coupon.remove}
            />
          </section>
          <div className={events.factRow}>
            <Icon name="shield" size={18} />
            <span>{`${ground.refundRule} ${GROUND_CANCELS}`}</span>
          </div>
          <p className={order.faint}>{`You’ll pay on Cashfree’s secure page. The slots are held for ${rules.holdMinutes} minutes while you pay.`}</p>
        </>
      )}

      {failure && (
        <p className={order.error} role="alert">
          {failure}
        </p>
      )}

      <div className={shop.orderBar}>
        <span className={shop.orderText}>
          <strong>{summary.count ? `${summary.text} · ${money(stage === "pay" ? total : items)}` : "Pick a slot to book"}</strong>
          <span className={order.faint}>{weeks > 1 ? `${weeksText(weeks)} · every ${weekday}` : dayShort(day)}</span>
        </span>
        {stage === "pick" ? (
          <Button disabled={!summary.count || !repeatOk} onClick={toPay}>
            Pay
          </Button>
        ) : (
          <Button loading={busy} disabled={coupon.pricing || !summary.count || !repeatOk} onClick={() => void place()}>
            {coupon.pricing ? "Working out the price…" : `Pay ${money(total)}`}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Booking a ground: a court, a date, back-to-back slots, add-ons and weekly repeats, then the coupon and Cashfree. Same as the app. */
export function BookScreen({ id, courtId, date }: { id: string; courtId?: string; date?: string }) {
  const ground = useLoad(() => getGround(id), id);
  const rules = useLoad(turfRules, "turf");
  const error = ground.error ?? rules.error;
  if (ground.data && rules.data) {
    const g = ground.data;
    if (g.status !== "live" || !g.canBook || !g.courtList.some((c) => c.status === "live")) {
      return (
        <Empty title={g.whyNot ?? "This ground isn’t taking bookings right now."}>
          <p>Check the ground’s page for its courts and prices.</p>
          <ButtonLink href={`/grounds/${id}`} variant="secondary">
            Back to the ground
          </ButtonLink>
        </Empty>
      );
    }
    return <Booking ground={g} rules={rules.data} initialCourt={courtId} initialDay={date} />;
  }
  if (error) {
    return (
      <Empty title={error instanceof ApiError && error.status === 404 ? "Ground not found" : "Could not load this ground"}>
        <p>{formError(error).message}</p>
        <Button
          variant="secondary"
          icon={<Icon name="refresh" size={16} />}
          onClick={() => {
            ground.reload();
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
