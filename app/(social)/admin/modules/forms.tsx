"use client";

import { useState } from "react";
import { useCan } from "@/components/admin/AdminFrame";
import { Fact, styles } from "@/components/admin/parts";
import { useOnSignedOut } from "@/components/social/session";
import { Button, Card, Input, Switch, useToast } from "@/components/ui";
import { formError } from "@/lib/api/account";
import { updateModule, type ModulePatch, type ModuleSettings } from "@/lib/api/admin";
import { MODULE_LABEL } from "./labels";

const percentOf = (bps: number) => String(bps / 100);
const rupeesOf = (paise: number) => String(paise / 100);
const MAX_FEE_RUPEES = 500;
const MAX_PAYOUT_FEE_RUPEES = 100;
const MAX_MIN_PAYOUT_RUPEES = 100_000;
const paiseOf = (rupees: string) => (rupees.trim() === "" ? NaN : Math.round(Number(rupees) * 100));

/** The fee taken from each withdrawal and the least that can be withdrawn: vendors' on the ledger, Ruxstar partners' on delivery. Same as the app. */
export function Withdrawals({ m, payouts, onSaved }: { m: ModuleSettings; payouts: NonNullable<ModuleSettings["payouts"]>; onSaved: (m: ModuleSettings) => void }) {
  const toast = useToast();
  const who = m.module === "delivery" ? "partner" : "vendor";
  const onSignedOut = useOnSignedOut();
  const canManage = useCan("modules.manage");
  const [fee, setFee] = useState(rupeesOf(payouts.fee));
  const [minimum, setMinimum] = useState(rupeesOf(payouts.minimum));
  const [busy, setBusy] = useState(false);

  const feePaise = paiseOf(fee);
  const minPaise = paiseOf(minimum);
  const feeError = Number.isFinite(feePaise) && feePaise >= 0 && feePaise <= MAX_PAYOUT_FEE_RUPEES * 100 ? undefined : `Enter an amount from 0 to ${MAX_PAYOUT_FEE_RUPEES}`;
  const minError =
    !Number.isFinite(minPaise) || minPaise < 100 || minPaise > MAX_MIN_PAYOUT_RUPEES * 100
      ? `Enter an amount from 1 to ${MAX_MIN_PAYOUT_RUPEES.toLocaleString("en-IN")}`
      : !feeError && minPaise < feePaise + 100
        ? "At least ₹1 more than the fee"
        : undefined;
  const changed = feePaise !== payouts.fee || minPaise !== payouts.minimum;

  async function save() {
    setBusy(true);
    try {
      const done = await updateModule(m.module, { payoutFee: feePaise, minPayout: minPaise });
      onSaved(done);
      if (done.payouts) {
        setFee(rupeesOf(done.payouts.fee));
        setMinimum(rupeesOf(done.payouts.minimum));
      }
      toast("Withdrawal settings saved.", "success");
    } catch (err) {
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.toolbar}>
      <Input
        label="Fee taken from each withdrawal"
        inputMode="decimal"
        prefix="₹"
        value={fee}
        onChange={(e) => setFee(e.target.value.replace(/[^\d.]/g, ""))}
        disabled={!canManage}
        hint={`Covers Cashfree's charge. The ${who} gets the rest. 0 for none.`}
        error={feeError}
      />
      <Input
        label={`Least a ${who} can withdraw`}
        inputMode="decimal"
        prefix="₹"
        value={minimum}
        onChange={(e) => setMinimum(e.target.value.replace(/[^\d.]/g, ""))}
        disabled={!canManage}
        error={minError}
      />
      {canManage && (
        <Button variant="secondary" disabled={!!feeError || !!minError || !changed} loading={busy} onClick={() => void save()}>
          Save withdrawal settings
        </Button>
      )}
    </div>
  );
}

const MAX_RATE_RUPEES = 1000;
const wholeOf = (text: string) => (/^\d+$/.test(text.trim()) ? Number(text) : NaN);
const rupeeError = (paise: number) => (Number.isFinite(paise) && paise >= 0 && paise <= MAX_RATE_RUPEES * 100 ? undefined : `Enter an amount from 0 to ${MAX_RATE_RUPEES}`);
const rupees = (set: (v: string) => void) => (value: string) => set(value.replace(/[^\d.]/g, ""));
const whole = (set: (v: string) => void) => (value: string) => set(value.replace(/\D/g, ""));

/** Delivery only: what a Ruxstar partner is paid for a trip, the most a shop can charge, and how long an offer waits. Same as the app. */
export function DeliveryRates({ m, delivery: d, onSaved }: { m: ModuleSettings; delivery: NonNullable<ModuleSettings["delivery"]>; onSaved: (m: ModuleSettings) => void }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const canManage = useCan("modules.manage");
  const [riderBase, setRiderBase] = useState(rupeesOf(d.riderRate.base));
  const [riderKm, setRiderKm] = useState(String(d.riderRate.includedKm));
  const [riderPerKm, setRiderPerKm] = useState(rupeesOf(d.riderRate.perKm));
  const [shopBase, setShopBase] = useState(rupeesOf(d.shopFeeMax.base));
  const [shopPerKm, setShopPerKm] = useState(rupeesOf(d.shopFeeMax.perKm));
  const [minutes, setMinutes] = useState(String(d.offerMinutes));
  const [busy, setBusy] = useState(false);

  const riderRate = { base: paiseOf(riderBase), includedKm: wholeOf(riderKm), perKm: paiseOf(riderPerKm) };
  const shopFeeMax = { base: paiseOf(shopBase), perKm: paiseOf(shopPerKm) };
  const offerMinutes = wholeOf(minutes);
  const errors = {
    riderBase: rupeeError(riderRate.base),
    riderKm: riderRate.includedKm >= 0 && riderRate.includedKm <= 50 ? undefined : "Enter whole km from 0 to 50",
    riderPerKm: rupeeError(riderRate.perKm),
    shopBase: rupeeError(shopFeeMax.base),
    shopPerKm: rupeeError(shopFeeMax.perKm),
    minutes: offerMinutes >= 1 && offerMinutes <= 120 ? undefined : "Enter whole minutes from 1 to 120",
  };
  const invalid = Object.values(errors).some(Boolean);
  const changed =
    riderRate.base !== d.riderRate.base ||
    riderRate.includedKm !== d.riderRate.includedKm ||
    riderRate.perKm !== d.riderRate.perKm ||
    shopFeeMax.base !== d.shopFeeMax.base ||
    shopFeeMax.perKm !== d.shopFeeMax.perKm ||
    offerMinutes !== d.offerMinutes;

  async function save() {
    setBusy(true);
    try {
      onSaved(await updateModule(m.module, { riderRate, shopFeeMax, offerMinutes }));
      toast("Delivery rates saved.", "success");
    } catch (err) {
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={styles.group}>
        <h3 className={styles.label}>Ruxstar partner pay, per trip</h3>
        <p className={styles.muted}>Paid to the partner out of the shop&apos;s share. The partner keeps all of it.</p>
      </div>
      <div className={styles.toolbar}>
        <Input label="Base (₹)" inputMode="decimal" value={riderBase} onChange={(e) => rupees(setRiderBase)(e.target.value)} disabled={!canManage} error={errors.riderBase} />
        <Input label="Covers (km)" inputMode="numeric" value={riderKm} onChange={(e) => whole(setRiderKm)(e.target.value)} disabled={!canManage} error={errors.riderKm} />
        <Input label="Each km after (₹)" inputMode="decimal" value={riderPerKm} onChange={(e) => rupees(setRiderPerKm)(e.target.value)} disabled={!canManage} error={errors.riderPerKm} />
      </div>
      <h3 className={styles.label}>Most a shop can charge customers</h3>
      <div className={styles.toolbar}>
        <Input label="Base (₹)" inputMode="decimal" value={shopBase} onChange={(e) => rupees(setShopBase)(e.target.value)} disabled={!canManage} error={errors.shopBase} />
        <Input label="Per km (₹)" inputMode="decimal" value={shopPerKm} onChange={(e) => rupees(setShopPerKm)(e.target.value)} disabled={!canManage} error={errors.shopPerKm} />
      </div>
      <div className={styles.toolbar}>
        <Input
          label="Offer waits (minutes)"
          inputMode="numeric"
          value={minutes}
          onChange={(e) => whole(setMinutes)(e.target.value)}
          disabled={!canManage}
          hint="If no partner accepts by then, the offer is cancelled and the shop is told."
          error={errors.minutes}
        />
        {canManage && (
          <Button variant="secondary" disabled={invalid || !changed} loading={busy} onClick={() => void save()}>
            Save delivery rates
          </Button>
        )}
      </div>
    </>
  );
}

type EventRules = NonNullable<ModuleSettings["eventRules"]>;
type RuleKey = keyof EventRules;

/** The API's limits for each rule, and the words around each field. */
const RULES: { key: RuleKey; min: number; max: number; label: string; unit: string; hint: string }[] = [
  {
    key: "refundHours",
    min: 0,
    max: 720,
    label: "Refunds stop this many hours before the start",
    unit: "hours",
    hint: "Customers can cancel for a full refund until then. Applies to every event at once, tickets already sold included. 0 lets them cancel right up to the start. Organisers can still choose no refunds.",
  },
  {
    key: "waitlistHours",
    min: 1,
    max: 48,
    label: "Hours to pay for seats from the waitlist",
    unit: "hours",
    hint: "When seats free up, the next person waiting gets this long to pay. Then the offer moves on.",
  },
  {
    key: "maxTicketTypes",
    min: 1,
    max: 10,
    label: "Ticket types per event",
    unit: "",
    hint: "Like General, VIP and Early bird. Checked when an organiser saves an event; events that already have more keep them until edited.",
  },
  {
    key: "maxQuestions",
    min: 0,
    max: 10,
    label: "Questions per ticket holder",
    unit: "",
    hint: "Extra questions an organiser can ask each person, like T-shirt size. 0 turns them off for new and edited events.",
  },
];

const rulesText = (rules: EventRules) => Object.fromEntries(RULES.map((f) => [f.key, String(rules[f.key])])) as Record<RuleKey, string>;
const plural = (n: number, unit: string) => (unit ? `${n} ${n === 1 ? unit.slice(0, -1) : unit}` : String(n));

/** Events only: the refund window, the waitlist's time to pay, and how much an organiser can add to one event. Same as the app. */
function EventRulesForm({ m, rules, onSaved }: { m: ModuleSettings; rules: EventRules; onSaved: (m: ModuleSettings) => void }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const canManage = useCan("modules.manage");
  const [text, setText] = useState(() => rulesText(rules));
  const [busy, setBusy] = useState(false);

  const values = Object.fromEntries(RULES.map((f) => [f.key, wholeOf(text[f.key])])) as Record<RuleKey, number>;
  const errors = Object.fromEntries(
    RULES.map((f) => [f.key, values[f.key] >= f.min && values[f.key] <= f.max ? undefined : `Enter a whole number from ${f.min} to ${f.max}`]),
  ) as Record<RuleKey, string | undefined>;
  const invalid = RULES.some((f) => errors[f.key]);
  const changes = Object.fromEntries(RULES.filter((f) => values[f.key] !== rules[f.key]).map((f) => [f.key, values[f.key]])) as Partial<EventRules>;
  const changed = Object.keys(changes).length > 0;

  async function save() {
    setBusy(true);
    try {
      const done = await updateModule(m.module, { eventRules: changes });
      onSaved(done);
      if (done.eventRules) setText(rulesText(done.eventRules));
      toast("Event rules saved.", "success");
    } catch (err) {
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={styles.group}>
        <h3 className={styles.label}>Event rules</h3>
        <p className={styles.muted}>Every organiser&apos;s events follow these.</p>
      </div>
      {canManage ? (
        <div className={styles.group}>
          {RULES.map((f) => (
            <Input
              key={f.key}
              label={f.label}
              inputMode="numeric"
              value={text[f.key]}
              onChange={(e) => whole((v) => setText((all) => ({ ...all, [f.key]: v })))(e.target.value)}
              suffix={f.unit || undefined}
              hint={errors[f.key] ? undefined : f.hint}
              error={errors[f.key]}
              maxLength={3}
            />
          ))}
          <div>
            <Button variant="secondary" disabled={invalid || !changed} loading={busy} onClick={() => void save()}>
              Save event rules
            </Button>
          </div>
        </div>
      ) : (
        <dl className={styles.facts}>
          {RULES.map((f) => (
            <Fact key={f.key} label={f.label} value={plural(rules[f.key], f.unit)} />
          ))}
        </dl>
      )}
    </>
  );
}

type CoachingRules = NonNullable<ModuleSettings["coachingRules"]>;
type CoachingKey = keyof CoachingRules;

/** The API's limits for each coaching rule. `rupees` fields are paise in the API and typed in rupees here. */
const COACHING_RULES: { key: CoachingKey; min: number; max: number; label: string; unit: string; hint: string; rupees?: boolean }[] = [
  {
    key: "certificatePercent",
    min: 1,
    max: 100,
    label: "Attendance for a certificate",
    unit: "%",
    hint: "When a batch ends, students who came to this share of its classes get a certificate. A course can set its own.",
  },
  {
    key: "minimumHours",
    min: 1,
    max: 168,
    label: "Minimum batch size is checked this many hours before the first class",
    unit: "hours",
    hint: "A batch short of its minimum then is cancelled and everyone refunded in full.",
  },
  { key: "maxBatchSize", min: 1, max: 1000, label: "Students per batch", unit: "", hint: "The most seats an institute can give one batch." },
  { key: "maxClasses", min: 1, max: 500, label: "Classes per batch", unit: "", hint: "Extra classes count too." },
  { key: "maxBatches", min: 1, max: 100, label: "Batches per course", unit: "", hint: "Batches running or still to start in one course." },
  { key: "maxDemoFee", min: 0, max: 10_000, label: "Most a demo class can cost", unit: "₹", hint: "0 means demo classes are free.", rupees: true },
  { key: "maxDemoSeats", min: 1, max: 50, label: "Demo students per class", unit: "", hint: "The most an institute can let into one class for a demo." },
  { key: "joinMinutes", min: 0, max: 120, label: "Online join link shows this many minutes before a class", unit: "minutes", hint: "Students see the meeting link from then until the class ends." },
];

const coachingText = (rules: CoachingRules) =>
  Object.fromEntries(COACHING_RULES.map((f) => [f.key, String(f.rupees ? rules[f.key] / 100 : rules[f.key])])) as Record<CoachingKey, string>;
const coachingFact = (f: (typeof COACHING_RULES)[number], value: number) =>
  f.rupees ? (value ? `₹${(value / 100).toLocaleString("en-IN")}` : "Free only") : f.unit === "%" ? `${value}%` : plural(value, f.unit);

/** Coaching only: certificates, the minimum-size check, limits per batch and course, demo classes and the join link. Same as the app. */
function CoachingRulesForm({ m, rules, onSaved }: { m: ModuleSettings; rules: CoachingRules; onSaved: (m: ModuleSettings) => void }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const canManage = useCan("modules.manage");
  const [text, setText] = useState(() => coachingText(rules));
  const [busy, setBusy] = useState(false);

  const typed = Object.fromEntries(COACHING_RULES.map((f) => [f.key, wholeOf(text[f.key])])) as Record<CoachingKey, number>;
  const errors = Object.fromEntries(
    COACHING_RULES.map((f) => [f.key, typed[f.key] >= f.min && typed[f.key] <= f.max ? undefined : `Enter a whole number from ${f.min} to ${f.max.toLocaleString("en-IN")}`]),
  ) as Record<CoachingKey, string | undefined>;
  const invalid = COACHING_RULES.some((f) => errors[f.key]);
  const values = Object.fromEntries(COACHING_RULES.map((f) => [f.key, f.rupees ? typed[f.key] * 100 : typed[f.key]])) as Record<CoachingKey, number>;
  const changes = Object.fromEntries(COACHING_RULES.filter((f) => values[f.key] !== rules[f.key]).map((f) => [f.key, values[f.key]])) as Partial<CoachingRules>;
  const changed = Object.keys(changes).length > 0;

  async function save() {
    setBusy(true);
    try {
      const done = await updateModule(m.module, { coachingRules: changes });
      onSaved(done);
      if (done.coachingRules) setText(coachingText(done.coachingRules));
      toast("Coaching rules saved.", "success");
    } catch (err) {
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={styles.group}>
        <h3 className={styles.label}>Coaching rules</h3>
        <p className={styles.muted}>Every institute&apos;s courses follow these.</p>
      </div>
      {canManage ? (
        <div className={styles.group}>
          {COACHING_RULES.map((f) => (
            <Input
              key={f.key}
              label={f.label}
              inputMode="numeric"
              value={text[f.key]}
              onChange={(e) => whole((v) => setText((all) => ({ ...all, [f.key]: v })))(e.target.value)}
              prefix={f.rupees ? "₹" : undefined}
              suffix={!f.rupees && f.unit ? f.unit : undefined}
              hint={errors[f.key] ? undefined : f.hint}
              error={errors[f.key]}
              maxLength={5}
            />
          ))}
          <div>
            <Button variant="secondary" disabled={invalid || !changed} loading={busy} onClick={() => void save()}>
              Save coaching rules
            </Button>
          </div>
        </div>
      ) : (
        <dl className={styles.facts}>
          {COACHING_RULES.map((f) => (
            <Fact key={f.key} label={f.label} value={coachingFact(f, rules[f.key])} />
          ))}
        </dl>
      )}
    </>
  );
}

type TurfRules = NonNullable<ModuleSettings["turfRules"]>;
type TurfKey = Exclude<keyof TurfRules, "slotLengths">;
type SlotLength = TurfRules["slotLengths"][number];
const SLOT_LENGTHS: { value: SlotLength; label: string }[] = [
  { value: 30, label: "30-minute slots" },
  { value: 60, label: "1-hour slots" },
  { value: 90, label: "1½-hour slots" },
];

/** The API's limits for each turf rule. */
const TURF_RULES: { key: TurfKey; min: number; max: number; label: string; unit: string; hint: string }[] = [
  { key: "refundFullHours", min: 0, max: 168, label: "New grounds: full refund from", unit: "hours", hint: "Hours before the slot. Owners can change it within the limits below." },
  { key: "refundHalfHours", min: 0, max: 168, label: "New grounds: part refund from", unit: "hours", hint: "Until the full-refund hours. The same number means no part refund." },
  { key: "halfPercent", min: 0, max: 100, label: "Part refund", unit: "%", hint: "The share refunded in the middle tier." },
  { key: "minFullHours", min: 0, max: 168, label: "Owners’ full-refund hours, at least", unit: "hours", hint: "A ground outside new limits is held to them from its next booking." },
  { key: "maxFullHours", min: 0, max: 168, label: "Owners’ full-refund hours, at most", unit: "hours", hint: "Bookings already made keep their rule." },
  { key: "maxRepeatWeeks", min: 1, max: 52, label: "Weekly repeat, at most", unit: "weeks", hint: "The first week included, all paid at once." },
  { key: "holdMinutes", min: 5, max: 60, label: "Slots held for checkout", unit: "minutes", hint: "Unpaid slots free up after this." },
  { key: "maxSlots", min: 1, max: 48, label: "Back-to-back slots in one booking", unit: "", hint: "The most a player can pick on one court and day." },
  { key: "bookAheadDays", min: 1, max: 180, label: "Players can book ahead", unit: "days", hint: "How far ahead the first slot can be." },
  { key: "maxGrounds", min: 1, max: 100, label: "Grounds per business", unit: "", hint: "Drafts count too." },
  { key: "maxCourts", min: 1, max: 100, label: "Courts per ground", unit: "", hint: "Paused courts count too." },
  { key: "maxAddOns", min: 0, max: 30, label: "Add-ons per court", unit: "", hint: "0 turns add-ons off for new changes." },
];

const turfText = (rules: TurfRules) => Object.fromEntries(TURF_RULES.map((f) => [f.key, String(rules[f.key])])) as Record<TurfKey, string>;
const turfFact = (f: (typeof TURF_RULES)[number], value: number) => (f.unit === "%" ? `${value}%` : plural(value, f.unit));

/** Sports and turf only: refund defaults and limits, weekly repeats, the checkout hold, slot lengths and limits per business. Same as the app. */
function TurfRulesForm({ m, rules, onSaved }: { m: ModuleSettings; rules: TurfRules; onSaved: (m: ModuleSettings) => void }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const canManage = useCan("modules.manage");
  const [text, setText] = useState(() => turfText(rules));
  const [lengths, setLengths] = useState<SlotLength[]>(() => rules.slotLengths);
  const [busy, setBusy] = useState(false);

  const typed = Object.fromEntries(TURF_RULES.map((f) => [f.key, wholeOf(text[f.key])])) as Record<TurfKey, number>;
  const errors = Object.fromEntries(
    TURF_RULES.map((f) => [f.key, typed[f.key] >= f.min && typed[f.key] <= f.max ? undefined : `Enter a whole number from ${f.min} to ${f.max.toLocaleString("en-IN")}`]),
  ) as Record<TurfKey, string | undefined>;
  if (!errors.refundHalfHours && !errors.refundFullHours && typed.refundHalfHours > typed.refundFullHours) errors.refundHalfHours = "No more than the full-refund hours";
  if (!errors.maxFullHours && !errors.minFullHours && typed.maxFullHours < typed.minFullHours) errors.maxFullHours = "At least the lowest full-refund hours";
  const invalid = TURF_RULES.some((f) => errors[f.key]) || lengths.length === 0;
  const changes = Object.fromEntries(TURF_RULES.filter((f) => typed[f.key] !== rules[f.key]).map((f) => [f.key, typed[f.key]])) as Partial<TurfRules>;
  const sortedLengths = [...lengths].sort((a, b) => a - b);
  if (sortedLengths.join() !== [...rules.slotLengths].sort((a, b) => a - b).join()) changes.slotLengths = sortedLengths;
  const changed = Object.keys(changes).length > 0;

  async function save() {
    setBusy(true);
    try {
      const done = await updateModule(m.module, { turfRules: changes });
      onSaved(done);
      if (done.turfRules) {
        setText(turfText(done.turfRules));
        setLengths(done.turfRules.slotLengths);
      }
      toast("Turf rules saved.", "success");
    } catch (err) {
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={styles.group}>
        <h3 className={styles.label}>Sports and turf rules</h3>
        <p className={styles.muted}>Every ground follows these. Bookings already made keep the refund rule they were made with.</p>
      </div>
      {canManage ? (
        <div className={styles.group}>
          {TURF_RULES.map((f) => (
            <Input
              key={f.key}
              label={f.label}
              inputMode="numeric"
              value={text[f.key]}
              onChange={(e) => whole((v) => setText((all) => ({ ...all, [f.key]: v })))(e.target.value)}
              suffix={f.unit || undefined}
              hint={errors[f.key] ? undefined : f.hint}
              error={errors[f.key]}
              maxLength={3}
            />
          ))}
          <div className={styles.group}>
            <span className={styles.label}>Slot lengths courts can use</span>
            {SLOT_LENGTHS.map((l) => (
              <Switch
                key={l.value}
                checked={lengths.includes(l.value)}
                onChange={(on) => setLengths((all) => (on ? [...all, l.value] : all.filter((x) => x !== l.value)))}
                description={lengths.length === 1 && lengths.includes(l.value) ? "Keep at least one" : undefined}
              >
                {l.label}
              </Switch>
            ))}
            <p className={styles.muted}>Courts already using a length you turn off keep it until their owner changes it.</p>
          </div>
          <div>
            <Button variant="secondary" disabled={invalid || !changed} loading={busy} onClick={() => void save()}>
              Save turf rules
            </Button>
          </div>
        </div>
      ) : (
        <dl className={styles.facts}>
          {TURF_RULES.map((f) => (
            <Fact key={f.key} label={f.label} value={turfFact(f, rules[f.key])} />
          ))}
          <Fact label="Slot lengths" value={SLOT_LENGTHS.filter((l) => rules.slotLengths.includes(l.value)).map((l) => l.label).join(", ")} />
        </dl>
      )}
    </>
  );
}

type StaysRules = NonNullable<ModuleSettings["staysRules"]>;
type StaysKey = keyof StaysRules;

/** The API's limits for each stays rule. */
const STAYS_RULES: { key: StaysKey; min: number; max: number; label: string; unit: string; hint: string }[] = [
  { key: "refundDays", min: 0, max: 60, label: "New properties: full refund until", unit: "days", hint: "Days before move-in. Owners can only make it stricter." },
  { key: "maxRefundDays", min: 0, max: 60, label: "Owners’ refund days, at most", unit: "days", hint: "A property outside new limits is held to them from its next reservation." },
  { key: "objectionHours", min: 1, max: 168, label: "Tenant can object for", unit: "hours", hint: "After the owner marks Moved in. The owner is paid after this." },
  { key: "maxMonths", min: 1, max: 12, label: "Months paid with a reservation", unit: "months", hint: "PG and co-living, the first month included." },
  { key: "maxNights", min: 1, max: 90, label: "Nights in one hostel reservation", unit: "nights", hint: "The most a tenant can pick at once." },
  { key: "holdMinutes", min: 5, max: 60, label: "Beds held for checkout", unit: "minutes", hint: "Unpaid reservations free their beds after this." },
  { key: "bookAheadDays", min: 1, max: 180, label: "Tenants can reserve ahead", unit: "days", hint: "How far ahead move-in can be." },
  { key: "maxProperties", min: 1, max: 100, label: "Properties per business", unit: "", hint: "Drafts count too." },
  { key: "maxRooms", min: 1, max: 500, label: "Rooms per property", unit: "", hint: "Rooms marked full count too." },
  { key: "maxBeds", min: 1, max: 24, label: "Beds per room", unit: "", hint: "Shared rooms; a private room is one unit however many beds." },
];

const staysText = (rules: StaysRules) => Object.fromEntries(STAYS_RULES.map((f) => [f.key, String(rules[f.key])])) as Record<StaysKey, string>;

/** PG and hostels only: the refund rule and its limits, the objection window, months and nights, the checkout hold and limits per business. */
function StaysRulesForm({ m, rules, onSaved }: { m: ModuleSettings; rules: StaysRules; onSaved: (m: ModuleSettings) => void }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const canManage = useCan("modules.manage");
  const [text, setText] = useState(() => staysText(rules));
  const [busy, setBusy] = useState(false);

  const typed = Object.fromEntries(STAYS_RULES.map((f) => [f.key, wholeOf(text[f.key])])) as Record<StaysKey, number>;
  const errors = Object.fromEntries(
    STAYS_RULES.map((f) => [f.key, typed[f.key] >= f.min && typed[f.key] <= f.max ? undefined : `Enter a whole number from ${f.min} to ${f.max.toLocaleString("en-IN")}`]),
  ) as Record<StaysKey, string | undefined>;
  if (!errors.refundDays && !errors.maxRefundDays && typed.maxRefundDays < typed.refundDays) errors.maxRefundDays = "At least the refund days for new properties";
  const invalid = STAYS_RULES.some((f) => errors[f.key]);
  const changes = Object.fromEntries(STAYS_RULES.filter((f) => typed[f.key] !== rules[f.key]).map((f) => [f.key, typed[f.key]])) as Partial<StaysRules>;
  const changed = Object.keys(changes).length > 0;

  async function save() {
    setBusy(true);
    try {
      const done = await updateModule(m.module, { staysRules: changes });
      onSaved(done);
      if (done.staysRules) setText(staysText(done.staysRules));
      toast("PG and hostel rules saved.", "success");
    } catch (err) {
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={styles.group}>
        <h3 className={styles.label}>PG and hostel rules</h3>
        <p className={styles.muted}>Every property follows these. Reservations already made keep the refund rule they were made with.</p>
      </div>
      {canManage ? (
        <div className={styles.group}>
          {STAYS_RULES.map((f) => (
            <Input
              key={f.key}
              label={f.label}
              inputMode="numeric"
              value={text[f.key]}
              onChange={(e) => whole((v) => setText((all) => ({ ...all, [f.key]: v })))(e.target.value)}
              suffix={f.unit || undefined}
              hint={errors[f.key] ? undefined : f.hint}
              error={errors[f.key]}
              maxLength={3}
            />
          ))}
          <div>
            <Button variant="secondary" disabled={invalid || !changed} loading={busy} onClick={() => void save()}>
              Save PG and hostel rules
            </Button>
          </div>
        </div>
      ) : (
        <dl className={styles.facts}>
          {STAYS_RULES.map((f) => (
            <Fact key={f.key} label={f.label} value={plural(rules[f.key], f.unit)} />
          ))}
        </dl>
      )}
    </>
  );
}

type ShopRules = NonNullable<ModuleSettings["shopRules"]>;
type ShopKey = keyof ShopRules;

/** The API's limits for each local shop rule. */
const SHOP_RULES: { key: ShopKey; min: number; max: number; label: string; unit: string; hint: string }[] = [
  { key: "returnDays", min: 1, max: 30, label: "Returns can be asked for", unit: "days", hint: "After delivery, at shops that take returns. Orders made keep their days." },
  { key: "releaseHours", min: 1, max: 720, label: "Shop is paid after", unit: "hours", hint: "After delivery, or when the return window ends if that is later." },
  { key: "acceptHours", min: 1, max: 72, label: "Shop must accept within", unit: "hours", hint: "A paid order not accepted by then is cancelled and refunded in full." },
  { key: "holdMinutes", min: 5, max: 60, label: "Checkout works for", unit: "minutes", hint: "Stock is only taken once it’s paid." },
  { key: "maxOptions", min: 1, max: 2, label: "Options per product", unit: "", hint: "Like size and colour." },
  { key: "maxValues", min: 1, max: 30, label: "Values per option", unit: "", hint: "Like S, M, L and XL." },
  { key: "maxVariants", min: 1, max: 100, label: "Variants per product", unit: "", hint: "Each combination sold, like M in blue." },
  { key: "maxProducts", min: 1, max: 5000, label: "Products per shop", unit: "", hint: "Hidden ones count too." },
  { key: "maxLines", min: 1, max: 50, label: "Lines in one order", unit: "", hint: "Different variants in one cart." },
  { key: "maxQuantity", min: 1, max: 100, label: "Of one variant in an order", unit: "", hint: "The most a customer can add at once." },
];

const shopText = (rules: ShopRules) => Object.fromEntries(SHOP_RULES.map((f) => [f.key, String(rules[f.key])])) as Record<ShopKey, string>;

/** Local shops only: the return window, when shops are paid and must accept, the checkout hold and limits per product and order. */
function ShopRulesForm({ m, rules, onSaved }: { m: ModuleSettings; rules: ShopRules; onSaved: (m: ModuleSettings) => void }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const canManage = useCan("modules.manage");
  const [text, setText] = useState(() => shopText(rules));
  const [busy, setBusy] = useState(false);

  const typed = Object.fromEntries(SHOP_RULES.map((f) => [f.key, wholeOf(text[f.key])])) as Record<ShopKey, number>;
  const errors = Object.fromEntries(
    SHOP_RULES.map((f) => [f.key, typed[f.key] >= f.min && typed[f.key] <= f.max ? undefined : `Enter a whole number from ${f.min} to ${f.max.toLocaleString("en-IN")}`]),
  ) as Record<ShopKey, string | undefined>;
  const invalid = SHOP_RULES.some((f) => errors[f.key]);
  const changes = Object.fromEntries(SHOP_RULES.filter((f) => typed[f.key] !== rules[f.key]).map((f) => [f.key, typed[f.key]])) as Partial<ShopRules>;
  const changed = Object.keys(changes).length > 0;

  async function save() {
    setBusy(true);
    try {
      const done = await updateModule(m.module, { shopRules: changes });
      onSaved(done);
      if (done.shopRules) setText(shopText(done.shopRules));
      toast("Local shop rules saved.", "success");
    } catch (err) {
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={styles.group}>
        <h3 className={styles.label}>Local shop rules</h3>
        <p className={styles.muted}>Every shop follows these. Orders already made keep their return days.</p>
      </div>
      {canManage ? (
        <div className={styles.group}>
          {SHOP_RULES.map((f) => (
            <Input
              key={f.key}
              label={f.label}
              inputMode="numeric"
              value={text[f.key]}
              onChange={(e) => whole((v) => setText((all) => ({ ...all, [f.key]: v })))(e.target.value)}
              suffix={f.unit || undefined}
              hint={errors[f.key] ? undefined : f.hint}
              error={errors[f.key]}
              maxLength={4}
            />
          ))}
          <div>
            <Button variant="secondary" disabled={invalid || !changed} loading={busy} onClick={() => void save()}>
              Save local shop rules
            </Button>
          </div>
        </div>
      ) : (
        <dl className={styles.facts}>
          {SHOP_RULES.map((f) => (
            <Fact key={f.key} label={f.label} value={plural(rules[f.key], f.unit)} />
          ))}
        </dl>
      )}
    </>
  );
}

/** Whichever rules this module has: events, coaching, sports and turf, PG and hostels, or local shops. */
export function Rules({ m, onSaved }: { m: ModuleSettings; onSaved: (m: ModuleSettings) => void }) {
  if (!m.eventRules && !m.coachingRules && !m.turfRules && !m.staysRules && !m.shopRules) return null;
  return (
    <Card as="section" padding="lg" className={styles.page}>
      {m.eventRules && <EventRulesForm m={m} rules={m.eventRules} onSaved={onSaved} />}
      {m.coachingRules && <CoachingRulesForm m={m} rules={m.coachingRules} onSaved={onSaved} />}
      {m.turfRules && <TurfRulesForm m={m} rules={m.turfRules} onSaved={onSaved} />}
      {m.staysRules && <StaysRulesForm m={m} rules={m.staysRules} onSaved={onSaved} />}
      {m.shopRules && <ShopRulesForm m={m} rules={m.shopRules} onSaved={onSaved} />}
    </Card>
  );
}

/** A module's switches, then its commission and platform fee. Turning it off asks first. */
export function ModuleCore({ m, onSaved }: { m: ModuleSettings; onSaved: (m: ModuleSettings) => void }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const canManage = useCan("modules.manage");
  const [busy, setBusy] = useState<keyof ModulePatch | null>(null);
  const [commission, setCommission] = useState(percentOf(m.commissionBps));
  const [fee, setFee] = useState(rupeesOf(m.platformFee));
  const [turningOff, setTurningOff] = useState(false);

  const bps = Math.round(Number(commission) * 100);
  const commissionValid = commission.trim() !== "" && Number.isFinite(bps) && bps >= 0 && bps <= 10000;
  const feePaise = Math.round(Number(fee) * 100);
  const feeValid = fee.trim() !== "" && Number.isFinite(feePaise) && feePaise >= 0 && feePaise <= MAX_FEE_RUPEES * 100;

  async function save(patch: ModulePatch) {
    setBusy(Object.keys(patch)[0] as keyof ModulePatch);
    try {
      const done = await updateModule(m.module, patch);
      onSaved(done);
      setCommission(percentOf(done.commissionBps));
      setFee(rupeesOf(done.platformFee));
      toast(`${MODULE_LABEL[m.module]} saved.`, "success");
    } catch (err) {
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setBusy(null);
    }
  }

  const locked = !canManage || busy !== null;

  return (
    <>
      <Card as="section" padding="lg" className={styles.page} aria-labelledby="module-switches">
        <h2 id="module-switches" className={styles.subtitle}>
          Switches
        </h2>
        <div className={styles.group}>
          <Switch
            checked={m.live}
            onChange={(live) => (live ? void save({ live }) : setTurningOff(true))}
            disabled={locked || turningOff}
            description="Off hides it everywhere, for everyone."
          >
            Live
          </Switch>
          {turningOff && (
            <div className={styles.note}>
              <span className={styles.whoRow}>
                <strong>Turn {MODULE_LABEL[m.module]} off?</strong>
                <span className={styles.muted}>It&apos;s hidden everywhere, for everyone, at once. You can turn it back on any time.</span>
              </span>
              <div className={styles.actions}>
                <Button variant="ghost" disabled={busy === "live"} onClick={() => setTurningOff(false)}>
                  Cancel
                </Button>
                <Button variant="danger" loading={busy === "live"} onClick={() => void save({ live: false }).then(() => setTurningOff(false))}>
                  Turn off
                </Button>
              </div>
            </div>
          )}
          <Switch
            checked={m.signupsOpen}
            onChange={(signupsOpen) => save({ signupsOpen })}
            disabled={locked}
            description="Off keeps current vendors working but stops new ones joining."
          >
            New vendors can join
          </Switch>
          <Switch
            checked={m.deliveryEnabled}
            onChange={(deliveryEnabled) => save({ deliveryEnabled })}
            disabled={locked}
            description="Orders can be sent with a Ruxstar delivery partner."
          >
            Delivery
          </Switch>
          {m.gstinRequired !== null && (
            <Switch
              checked={m.gstinRequired}
              onChange={(gstinRequired) => save({ gstinRequired })}
              disabled={locked}
              description="New businesses need a verified GSTIN. Live ones without one stay live."
            >
              GSTIN needed to publish
            </Switch>
          )}
        </div>
      </Card>
      <Card as="section" padding="lg" className={styles.page} aria-labelledby="module-money">
        <h2 id="module-money" className={styles.subtitle}>
          Commission and fee
        </h2>
        <div className={styles.toolbar}>
          <Input
            label="Commission on each order"
            inputMode="decimal"
            suffix="%"
            value={commission}
            onChange={(e) => setCommission(e.target.value.replace(/[^\d.]/g, ""))}
            disabled={!canManage}
            error={commissionValid ? undefined : "Enter a number from 0 to 100"}
          />
          {canManage && (
            <Button
              variant="secondary"
              disabled={!commissionValid || bps === m.commissionBps || (busy !== null && busy !== "commissionBps")}
              loading={busy === "commissionBps"}
              onClick={() => save({ commissionBps: bps })}
            >
              Save commission
            </Button>
          )}
        </div>
        <div className={styles.toolbar}>
          <Input
            label="Platform fee the customer pays on each order"
            inputMode="decimal"
            prefix="₹"
            value={fee}
            onChange={(e) => setFee(e.target.value.replace(/[^\d.]/g, ""))}
            disabled={!canManage}
            hint="Added to the customer's total and kept by Ruxstar. 0 for none."
            error={feeValid ? undefined : `Enter an amount from 0 to ${MAX_FEE_RUPEES}`}
          />
          {canManage && (
            <Button
              variant="secondary"
              disabled={!feeValid || feePaise === m.platformFee || (busy !== null && busy !== "platformFee")}
              loading={busy === "platformFee"}
              onClick={() => save({ platformFee: feePaise })}
            >
              Save platform fee
            </Button>
          )}
        </div>
      </Card>
    </>
  );
}
