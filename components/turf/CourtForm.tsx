"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button, Input, Switch } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { Back, Failed, Loading } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { formError } from "@/lib/api/account";
import { ApiError, newIdempotencyKey } from "@/lib/api/client";
import { addCourt, listSports, removeCourt, turfRules, updateCourt, vendorGround, type CourtInput, type CourtView, type Hours, type SlotMinutes, type Sport, type TurfRulesView, type VendorGround } from "@/lib/api/turf";
import { DAY_LONG, HALF_HOURS, slotLengthText, WEEK } from "@/lib/turf";
import { PricesFields, pricesDraftOf, pricesErrors, pricesOf, type PricesDraft } from "./PricesFields";
import vendor from "@/components/vendor/vendor.module.css";
import styles from "./turf.module.css";

const MAX_SPORTS = 5;

interface DayDraft {
  open: boolean;
  from: string;
  to: string;
}
interface Draft {
  name: string;
  sports: string[];
  slotMinutes: SlotMinutes;
  days: Record<number, DayDraft>;
  prices: PricesDraft;
  live: boolean;
}

const minutes = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));

function draftOf(rules: TurfRulesView, court?: CourtView): Draft {
  const days: Record<number, DayDraft> = {};
  for (const d of WEEK) {
    const h = court?.hours.find((x) => x.day === d);
    days[d] = h ? { open: true, from: h.open, to: h.close } : { open: !court, from: "06:00", to: "23:00" };
  }
  return {
    name: court?.name ?? "",
    sports: court?.sports.map((s) => s.key) ?? [],
    slotMinutes: (court?.slotMinutes as SlotMinutes | undefined) ?? (rules.slotLengths.includes(60) ? 60 : rules.slotLengths[0]),
    days,
    prices: pricesDraftOf(court),
    live: court ? court.status === "live" : true,
  };
}

const hoursOf = (d: Draft): Hours[] => WEEK.filter((day) => d.days[day].open).map((day) => ({ day, open: d.days[day].from, close: d.days[day].to }));

function errorsOf(d: Draft, rules: TurfRulesView): Record<string, string> {
  const e: Record<string, string> = { ...pricesErrors(d.prices, rules) };
  if (!d.name.trim()) e.name = "Name it, like Court 1 or Box A";
  if (!d.sports.length) e.sports = "Pick at least one sport";
  for (const day of WEEK) {
    const h = d.days[day];
    if (h.open && minutes(h.to) - minutes(h.from) < d.slotMinutes) e[`day${day}`] = `Close at least ${slotLengthText(d.slotMinutes)} after opening`;
  }
  return e;
}

function inputOf(d: Draft): CourtInput {
  const { prices, addOns } = pricesOf(d.prices);
  return { name: d.name.trim(), sports: d.sports, slotMinutes: d.slotMinutes, hours: hoursOf(d), prices, addOns, status: d.live ? "live" : "paused" };
}

function DayRow({ day, value, error, onChange }: { day: number; value: DayDraft; error?: string; onChange: (next: DayDraft) => void }) {
  return (
    <li>
      <label>
        <input type="checkbox" checked={value.open} onChange={(e) => onChange({ ...value, open: e.target.checked })} />
        {DAY_LONG[day]}
      </label>
      {value.open ? (
        <>
          <select className={vendor.select} aria-label={`${DAY_LONG[day]} opens`} value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })}>
            {HALF_HOURS.slice(0, 48).map((h) => (
              <option key={h.value} value={h.value}>
                {h.label}
              </option>
            ))}
          </select>
          <select className={vendor.select} aria-label={`${DAY_LONG[day]} closes`} value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })}>
            {HALF_HOURS.slice(1).map((h) => (
              <option key={h.value} value={h.value}>
                {h.label}
              </option>
            ))}
          </select>
        </>
      ) : (
        <span className={vendor.faint}>Closed</span>
      )}
      {error && (
        <p className={vendor.error} role="alert">
          {error}
        </p>
      )}
    </li>
  );
}

function Form({ rules, sports, ground, court }: { rules: TurfRulesView; sports: Sport[]; ground: VendorGround; court?: CourtView }) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => draftOf(rules, court));
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState<"save" | "remove" | null>(null);
  const [removing, setRemoving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const attempt = useRef(newIdempotencyKey());
  const errors = errorsOf(draft, rules);
  const shownErrors = shown ? errors : {};
  const back = `/vendor/grounds/${ground.id}`;
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const toggleSport = (key: string) =>
    set("sports", draft.sports.includes(key) ? draft.sports.filter((s) => s !== key) : draft.sports.length < MAX_SPORTS ? [...draft.sports, key] : draft.sports);
  const choices = [...sports, ...(court?.sports.filter((s) => !sports.some((x) => x.key === s.key)) ?? [])];

  const save = async () => {
    setShown(true);
    if (Object.keys(errors).length) return;
    setBusy("save");
    setFailure(null);
    try {
      const body = inputOf(draft);
      if (court) await updateCourt(court.id, body);
      else await addCourt(ground.id, body, attempt.current);
      router.push(back);
    } catch (e) {
      setFailure(formError(e).message);
      if (!(e instanceof ApiError && e.code === "NETWORK")) attempt.current = newIdempotencyKey();
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!court) return;
    setBusy("remove");
    setFailure(null);
    try {
      await removeCourt(court.id);
      router.replace(back);
    } catch (e) {
      setFailure(formError(e).message);
      setRemoving(false);
      setBusy(null);
    }
  };

  return (
    <div className={vendor.page}>
      <Back href={back}>{ground.name}</Back>
      <h1 className={vendor.title}>{court ? `Edit ${court.name}` : "Add a court"}</h1>
      <form
        className={vendor.form}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Input label="Court name" value={draft.name} onChange={(e) => set("name", e.target.value)} maxLength={40} placeholder="Like “Court 1” or “5-a-side box”" error={shownErrors.name} />

        <div className={vendor.field}>
          <span className={vendor.label} id="sports-label">
            Sports played here
          </span>
          <div className={vendor.chips} role="group" aria-labelledby="sports-label">
            {choices.map((s) => (
              <button key={s.key} type="button" className={vendor.chip} aria-pressed={draft.sports.includes(s.key)} onClick={() => toggleSport(s.key)}>
                {s.name}
              </button>
            ))}
          </div>
          <p className={vendor.faint}>{`Up to ${MAX_SPORTS}. Players pick one when the court has more.`}</p>
          {shownErrors.sports && (
            <p className={vendor.error} role="alert">
              {shownErrors.sports}
            </p>
          )}
        </div>

        <div className={vendor.field}>
          <span className={vendor.label} id="length-label">
            Each slot is
          </span>
          <div className={vendor.chips} role="radiogroup" aria-labelledby="length-label">
            {rules.slotLengths.map((m) => (
              <button key={m} type="button" role="radio" className={vendor.chip} aria-checked={draft.slotMinutes === m} aria-pressed={draft.slotMinutes === m} onClick={() => set("slotMinutes", m)}>
                {slotLengthText(m)}
              </button>
            ))}
          </div>
          <p className={vendor.faint}>Players can book back-to-back slots for longer games.</p>
        </div>

        <div className={vendor.field}>
          <span className={vendor.label}>Open hours</span>
          <ul className={styles.hours}>
            {WEEK.map((day) => (
              <DayRow key={day} day={day} value={draft.days[day]} error={shownErrors[`day${day}`]} onChange={(next) => set("days", { ...draft.days, [day]: next })} />
            ))}
          </ul>
          {court && ground.upcoming > 0 && <p className={vendor.faint}>Hours or slot length can’t change in a way that leaves a booked slot outside them.</p>}
        </div>

        <PricesFields draft={draft.prices} onChange={(next) => set("prices", next)} errors={shownErrors} rules={rules} hours={hoursOf(draft)} slotMinutes={draft.slotMinutes} />

        <div className={vendor.switches}>
          <Switch checked={draft.live} onChange={(v) => set("live", v)} description="Paused courts show on the ground page but can’t be booked. Bookings already made stay.">
            Taking bookings
          </Switch>
        </div>

        {failure && (
          <p className={vendor.error} role="alert">
            {failure}
          </p>
        )}
        {shown && Object.keys(errors).length > 0 && <p className={vendor.error}>Fix the fields marked above.</p>}
        <div className={vendor.actions}>
          <Button type="submit" size="lg" loading={busy === "save"} disabled={busy === "remove"}>
            {court ? "Save changes" : "Add court"}
          </Button>
        </div>
      </form>

      {court &&
        (removing ? (
          <section className={vendor.card}>
            <h2 className={vendor.section}>{`Remove ${court.name}?`}</h2>
            <p className={vendor.muted}>Only a court with no bookings still to come can be removed. Past bookings stay in your records.</p>
            <div className={vendor.actions}>
              <Button variant="danger" loading={busy === "remove"} onClick={() => void remove()}>
                Remove
              </Button>
              <Button variant="ghost" disabled={busy === "remove"} onClick={() => setRemoving(false)}>
                Keep it
              </Button>
            </div>
          </section>
        ) : (
          <div className={vendor.actions}>
            <button type="button" className={vendor.link} data-muted onClick={() => setRemoving(true)}>
              Remove this court
            </button>
          </div>
        ))}
    </div>
  );
}

/** Adding a court to a ground, or changing `courtId`: sports, slot length, open hours, prices and add-ons. */
export function CourtForm({ groundId, courtId }: { groundId: string; courtId?: string }) {
  const rules = useLoad(() => turfRules(), "turf");
  const sports = useLoad(() => listSports(), "sports");
  const ground = useLoad(() => vendorGround(groundId), groundId);
  const failed = rules.error ?? sports.error ?? ground.error;
  if (rules.data && sports.data && ground.data) {
    const court = courtId ? ground.data.courtList.find((c) => c.id === courtId) : undefined;
    if (courtId && !court)
      return (
        <Empty title="Court not found">
          <p>It may have been removed.</p>
        </Empty>
      );
    return <Form rules={rules.data} sports={sports.data} ground={ground.data} court={court} />;
  }
  if (failed)
    return (
      <Failed
        error={failed}
        onRetry={() => {
          rules.reload();
          sports.reload();
          ground.reload();
        }}
      />
    );
  return <Loading rows={5} />;
}
