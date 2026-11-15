"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button, Icon, Input } from "@/components/ui";
import { Back, Failed, Loading, TextArea } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { formError } from "@/lib/api/account";
import { ApiError, newIdempotencyKey } from "@/lib/api/client";
import {
  createProperty,
  deskUpdateProperty,
  getProperty,
  listFacilities,
  staysRules,
  updateProperty,
  vendorProperty,
  type Facility,
  type FoodType,
  type Meal,
  type NearbyKind,
  type Occupant,
  type Point,
  type PropertyDetail,
  type PropertyInput,
  type StayFor,
  type StayKind,
  type StaysRulesView,
  type VendorProperty,
} from "@/lib/api/stays";
import { HALF_HOURS } from "@/lib/turf";
import { FOOD_LABEL, FOR_LABEL, KIND_LABEL, KINDS, MEAL_LABEL, MEALS, NEARBY_LABEL, OCCUPANT_LABEL, paiseOf } from "@/lib/stays";
import vendor from "@/components/vendor/vendor.module.css";
import styles from "./stays.module.css";

const MAX_NEARBY = 15;
const FORS: StayFor[] = ["any", "men", "women"];
const OCCUPANTS: Occupant[] = ["students", "working"];
const FOODS: FoodType[] = ["veg", "non_veg", "none"];
const NEARBY_KINDS = Object.keys(NEARBY_LABEL) as NearbyKind[];
const ALLOWS = [
  { key: "guests", label: "Guests allowed" },
  { key: "smoking", label: "Smoking allowed" },
  { key: "alcohol", label: "Alcohol allowed" },
  { key: "pets", label: "Pets allowed" },
] as const;
type Allow = (typeof ALLOWS)[number]["key"];

interface NearbyDraft {
  kind: NearbyKind;
  name: string;
  km: string;
}
interface Draft {
  name: string;
  kind: StayKind;
  description: string;
  line: string;
  area: string;
  city: string;
  pincode: string;
  point: Point | null;
  for: StayFor;
  occupants: Occupant[];
  food: FoodType;
  meals: Meal[];
  facilities: string[];
  curfew: string;
  allows: Record<Allow, boolean>;
  notes: string;
  noticeDays: string;
  deposit: string;
  depositNote: string;
  nearby: NearbyDraft[];
  refundDays: string;
}

const whole = (text: string) => (/^\d+$/.test(text.trim()) ? Number(text.trim()) : null);
const rupees = (paise: number) => (paise ? String(paise / 100) : "");

function draftOf(rules: StaysRulesView, p?: PropertyDetail): Draft {
  return {
    name: p?.name ?? "",
    kind: p?.kind ?? "pg",
    description: p?.description ?? "",
    line: p?.addressDetail.line ?? "",
    area: p?.addressDetail.area ?? "",
    city: p?.addressDetail.city ?? "",
    pincode: p?.addressDetail.pincode ?? "",
    point: p?.addressDetail.point ?? null,
    for: p?.for ?? "any",
    occupants: p?.occupants ?? [],
    food: p?.food.type ?? "veg",
    meals: p?.food.meals ?? [],
    facilities: p?.facilities.map((f) => f.key) ?? [],
    curfew: p?.rules.curfew ?? "",
    allows: { guests: p?.rules.guests ?? false, smoking: p?.rules.smoking ?? false, alcohol: p?.rules.alcohol ?? false, pets: p?.rules.pets ?? false },
    notes: p?.rules.notes ?? "",
    noticeDays: String(p?.noticeDays ?? 30),
    deposit: rupees(p?.depositDetail.amount ?? 0),
    depositNote: p?.depositDetail.note ?? "",
    nearby: p?.nearby.map((n) => ({ kind: n.kind, name: n.name, km: String(n.km) })) ?? [],
    refundDays: String(p?.refundDays ?? rules.refundDays),
  };
}

const limitsOf = (rules: StaysRulesView, p?: PropertyDetail) =>
  p && "refundLimits" in p ? (p as VendorProperty).refundLimits : { min: rules.refundDays, max: Math.max(rules.maxRefundDays, rules.refundDays) };

function errorsOf(d: Draft, limits: { min: number; max: number }): Record<string, string> {
  const e: Record<string, string> = {};
  if (d.name.trim().length < 2) e.name = "At least 2 characters";
  if (d.line.trim().length < 5) e.line = "Building and street, so tenants find it";
  if (d.area.trim() && d.area.trim().length < 2) e.area = "At least 2 characters, or leave it empty";
  if (d.city.trim().length < 2) e.city = "The city";
  if (d.pincode.trim() && !/^[1-9]\d{5}$/.test(d.pincode.trim())) e.pincode = "6 digits, or leave it empty";
  const notice = whole(d.noticeDays);
  if (notice === null || notice > 90) e.noticeDays = "From 0 to 90 days";
  if (d.deposit.trim() && paiseOf(d.deposit) === null) e.deposit = "An amount in rupees, or leave it empty";
  const refund = whole(d.refundDays);
  if (refund === null || refund < limits.min || refund > limits.max) e.refundDays = `From ${limits.min} to ${limits.max} days`;
  d.nearby.forEach((n, i) => {
    const km = Number(n.km);
    if (n.name.trim().length < 2) e[`nearby${i}`] = "Name the place";
    else if (!n.km.trim() || !(km >= 0 && km <= 100)) e[`nearby${i}`] = "Distance in km, up to 100";
  });
  return e;
}

function inputOf(d: Draft, withRefund: boolean): PropertyInput {
  return {
    name: d.name.trim(),
    kind: d.kind,
    description: d.description.trim() || null,
    address: { line: d.line.trim(), area: d.area.trim() || null, city: d.city.trim(), pincode: d.pincode.trim() || null, point: d.point },
    for: d.for,
    occupants: d.occupants,
    food: { type: d.food, meals: d.food === "none" ? [] : d.meals },
    facilities: d.facilities,
    rules: { curfew: d.curfew || null, ...d.allows, notes: d.notes.trim() || null },
    noticeDays: Number(d.noticeDays),
    deposit: { amount: d.deposit.trim() ? (paiseOf(d.deposit) ?? 0) : 0, note: d.depositNote.trim() || null },
    nearby: d.nearby.map((n) => ({ kind: n.kind, name: n.name.trim(), km: Math.round(Number(n.km) * 10) / 10 })),
    ...(withRefund ? { refundDays: Number(d.refundDays) } : {}),
  };
}

function Chips<T extends string>({ label, options, picked, onToggle }: { label: string; options: { key: T; label: string }[]; picked: T[]; onToggle: (key: T) => void }) {
  const id = `chips-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div className={vendor.field}>
      <span className={vendor.label} id={id}>
        {label}
      </span>
      <div className={vendor.chips} role="group" aria-labelledby={id}>
        {options.map((o) => (
          <button key={o.key} type="button" className={vendor.chip} aria-pressed={picked.includes(o.key)} onClick={() => onToggle(o.key)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

type Mode = { kind: "new"; businessId: string } | { kind: "vendor"; property: VendorProperty } | { kind: "desk"; property: PropertyDetail };

function Form({ rules, facilities, mode }: { rules: StaysRulesView; facilities: Facility[]; mode: Mode }) {
  const router = useRouter();
  const property = mode.kind === "new" ? undefined : mode.property;
  const [draft, setDraft] = useState(() => draftOf(rules, property));
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const attempt = useRef(newIdempotencyKey());
  const limits = limitsOf(rules, property);
  const errors = errorsOf(draft, limits);
  const err = (field: string) => (shown ? errors[field] : undefined);
  const back = mode.kind === "new" ? `/vendor/businesses/${mode.businessId}/properties` : mode.kind === "vendor" ? `/vendor/properties/${mode.property.id}` : `/beds/${mode.property.id}`;
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const toggle = <T extends string>(list: T[], key: T) => (list.includes(key) ? list.filter((x) => x !== key) : [...list, key]);
  const setNearby = (i: number, patch: Partial<NearbyDraft>) => set("nearby", draft.nearby.map((n, j) => (j === i ? { ...n, ...patch } : n)));
  // Facilities Ruxstar has since switched off stay on the property until the owner removes them.
  const facilityOptions = [
    ...facilities.map((f) => ({ key: f.key, label: f.name })),
    ...(property?.facilities.filter((f) => !facilities.some((x) => x.key === f.key)).map((f) => ({ key: f.key, label: f.name })) ?? []),
  ];

  const locate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        set("point", { lat: Math.round(p.coords.latitude * 1e6) / 1e6, lng: Math.round(p.coords.longitude * 1e6) / 1e6 });
        setLocating(false);
      },
      () => {
        setFailure("Couldn’t get your location. Allow location for this site, or leave the pin out.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const save = async () => {
    setShown(true);
    if (Object.keys(errors).length) return;
    setBusy(true);
    setFailure(null);
    try {
      if (mode.kind === "new") {
        const created = await createProperty(mode.businessId, inputOf(draft, true), attempt.current);
        router.replace(`/vendor/properties/${created.id}?fresh=1`);
      } else if (mode.kind === "vendor") {
        await updateProperty(mode.property.id, inputOf(draft, true));
        router.push(back);
      } else {
        await deskUpdateProperty(mode.property.id, inputOf(draft, false));
        router.push(back);
      }
    } catch (e) {
      setFailure(formError(e).message);
      if (!(e instanceof ApiError && e.code === "NETWORK")) attempt.current = newIdempotencyKey();
      setBusy(false);
    }
  };

  return (
    <div className={vendor.page}>
      <Back href={back}>{mode.kind === "new" ? "Properties" : mode.kind === "desk" ? "Bed map" : "Property"}</Back>
      <h1 className={vendor.title}>{mode.kind === "new" ? "New PG or hostel" : "Edit details"}</h1>
      <form
        className={vendor.form}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Input label="Name" value={draft.name} onChange={(e) => set("name", e.target.value)} maxLength={80} placeholder="Like “Sri Sai PG for Women, Ameerpet”" error={err("name")} />
        <div className={vendor.field}>
          <span className={vendor.label} id="kind-label">
            Kind of place
          </span>
          <div className={vendor.chips} role="radiogroup" aria-labelledby="kind-label">
            {KINDS.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={draft.kind === k} className={vendor.chip} aria-pressed={draft.kind === k} onClick={() => set("kind", k)}>
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
          <p className={vendor.faint}>PG and co-living rooms usually go by the month, hostel beds by the night. Each room’s prices decide.</p>
        </div>
        <TextArea
          label="About the place (optional)"
          value={draft.description}
          onChange={(v) => set("description", v)}
          max={2000}
          placeholder="What it’s like, who lives here, how far the bus stop is"
        />

        <Input label="Address" value={draft.line} onChange={(e) => set("line", e.target.value)} maxLength={300} placeholder="Building, street" error={err("line")} />
        <div className={vendor.pair} data-even>
          <Input label="Area (optional)" value={draft.area} onChange={(e) => set("area", e.target.value)} maxLength={60} placeholder="Like Ameerpet" error={err("area")} />
          <Input label="City" value={draft.city} onChange={(e) => set("city", e.target.value)} maxLength={60} autoComplete="address-level2" error={err("city")} />
        </div>
        <Input
          label="PIN code (optional)"
          inputMode="numeric"
          value={draft.pincode}
          onChange={(e) => set("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))}
          autoComplete="postal-code"
          error={err("pincode")}
        />
        <div className={vendor.field}>
          <span className={vendor.label}>Map pin (optional)</span>
          <p className={vendor.faint}>{draft.point ? `Pinned at ${draft.point.lat}, ${draft.point.lng}. Tenants get directions to it.` : "Stand at the gate and pin it, so directions go to the right place."}</p>
          <div className={vendor.actions}>
            <Button type="button" variant="secondary" icon={<Icon name="locate" size={16} />} loading={locating} onClick={locate}>
              {draft.point ? "Pin again here" : "Pin where I am"}
            </Button>
            {draft.point && (
              <Button type="button" variant="ghost" onClick={() => set("point", null)}>
                Remove pin
              </Button>
            )}
          </div>
        </div>

        <div className={vendor.field}>
          <span className={vendor.label} id="for-label">
            Who it’s for
          </span>
          <div className={vendor.chips} role="radiogroup" aria-labelledby="for-label">
            {FORS.map((f) => (
              <button key={f} type="button" role="radio" aria-checked={draft.for === f} className={vendor.chip} aria-pressed={draft.for === f} onClick={() => set("for", f)}>
                {FOR_LABEL[f]}
              </button>
            ))}
          </div>
        </div>
        <Chips
          label="Best for (optional)"
          options={OCCUPANTS.map((o) => ({ key: o, label: OCCUPANT_LABEL[o] }))}
          picked={draft.occupants}
          onToggle={(o) => set("occupants", toggle(draft.occupants, o))}
        />

        <div className={vendor.field}>
          <span className={vendor.label} id="food-label">
            Food
          </span>
          <div className={vendor.chips} role="radiogroup" aria-labelledby="food-label">
            {FOODS.map((f) => (
              <button key={f} type="button" role="radio" aria-checked={draft.food === f} className={vendor.chip} aria-pressed={draft.food === f} onClick={() => set("food", f)}>
                {FOOD_LABEL[f]}
              </button>
            ))}
          </div>
        </div>
        {draft.food !== "none" && (
          <Chips label="Meals in the rent" options={MEALS.map((m) => ({ key: m, label: MEAL_LABEL[m] }))} picked={draft.meals} onToggle={(m) => set("meals", toggle(draft.meals, m))} />
        )}

        {facilityOptions.length > 0 && (
          <Chips label="Facilities" options={facilityOptions} picked={draft.facilities} onToggle={(f) => set("facilities", toggle(draft.facilities, f))} />
        )}

        <div className={vendor.field}>
          <span className={vendor.label}>House rules</span>
          <label className={styles.field}>
            Be in by
            <select className={vendor.select} value={draft.curfew} onChange={(e) => set("curfew", e.target.value)}>
              <option value="">No entry time</option>
              {HALF_HOURS.filter((h) => h.value !== "24:00").map((h) => (
                <option key={h.value} value={h.value}>
                  {h.label}
                </option>
              ))}
            </select>
          </label>
          <div className={styles.checks}>
            {ALLOWS.map((a) => (
              <label key={a.key}>
                <input type="checkbox" checked={draft.allows[a.key]} onChange={(e) => set("allows", { ...draft.allows, [a.key]: e.target.checked })} />
                {a.label}
              </label>
            ))}
          </div>
          <TextArea label="Other rules (optional)" value={draft.notes} onChange={(v) => set("notes", v)} max={500} placeholder="Like “No cooking in rooms” or “ID at the gate after 10 pm”" />
        </div>

        <div className={vendor.pair} data-even>
          <Input
            label="Notice to move out (days)"
            inputMode="numeric"
            value={draft.noticeDays}
            onChange={(e) => set("noticeDays", e.target.value.replace(/\D/g, "").slice(0, 2))}
            hint="0 for none"
            error={err("noticeDays")}
          />
          <Input
            label="Deposit (₹, optional)"
            inputMode="decimal"
            value={draft.deposit}
            onChange={(e) => set("deposit", e.target.value.replace(/[^\d.]/g, ""))}
            hint="Tenants pay it to you, not on Ruxstar"
            error={err("deposit")}
          />
        </div>
        {draft.deposit.trim() && Number(draft.deposit) > 0 && (
          <Input
            label="About the deposit (optional)"
            value={draft.depositNote}
            onChange={(e) => set("depositNote", e.target.value)}
            maxLength={200}
            placeholder="Like “Refunded within 7 days of moving out”"
          />
        )}

        <div className={vendor.field}>
          <span className={vendor.label}>Nearby places (optional)</span>
          <p className={vendor.faint}>Colleges, offices and metro stations tenants search for.</p>
          {draft.nearby.map((n, i) => (
            <div key={i} className={styles.nearbyRow}>
              <select className={vendor.select} aria-label={`Place ${i + 1}: kind`} value={n.kind} onChange={(e) => setNearby(i, { kind: e.target.value as NearbyKind })}>
                {NEARBY_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {NEARBY_LABEL[k]}
                  </option>
                ))}
              </select>
              <Input label={`Place ${i + 1}`} value={n.name} onChange={(e) => setNearby(i, { name: e.target.value })} maxLength={80} error={err(`nearby${i}`)} />
              <Input label="km" inputMode="decimal" value={n.km} onChange={(e) => setNearby(i, { km: e.target.value.replace(/[^\d.]/g, "").slice(0, 5) })} />
              <button type="button" className={vendor.iconButton} aria-label={`Remove place ${i + 1}`} onClick={() => set("nearby", draft.nearby.filter((_, j) => j !== i))}>
                <Icon name="trash" size={18} />
              </button>
            </div>
          ))}
          {draft.nearby.length < MAX_NEARBY && (
            <div>
              <Button type="button" variant="secondary" icon={<Icon name="plus" size={16} />} onClick={() => set("nearby", [...draft.nearby, { kind: "college", name: "", km: "" }])}>
                Add a place
              </Button>
            </div>
          )}
        </div>

        {mode.kind !== "desk" && (
          <div className={vendor.field}>
            <Input
              label="Full refund until (days before move-in)"
              inputMode="numeric"
              value={draft.refundDays}
              onChange={(e) => set("refundDays", e.target.value.replace(/\D/g, "").slice(0, 2))}
              hint={`From ${limits.min} to ${limits.max} days`}
              error={err("refundDays")}
            />
            {whole(draft.refundDays) !== null && (
              <p className={vendor.faint}>{`Tenants read: “Full refund until ${draft.refundDays} days before move-in. No refund after that.” If you cancel, they get everything back.`}</p>
            )}
          </div>
        )}

        {failure && (
          <p className={vendor.error} role="alert">
            {failure}
          </p>
        )}
        {mode.kind === "new" && <p className={vendor.faint}>It’s saved as a draft. Add photos and rooms, then publish it from the next screen.</p>}
        <div className={vendor.actions}>
          <Button type="submit" size="lg" loading={busy}>
            {mode.kind === "new" ? "Save as draft" : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}

/**
 * Making a PG or hostel for `businessId`, or changing `propertyId`: as its owner, or with `desk` as a team member allowed to
 * edit the listing (everything but the refund days). A new property is a draft.
 */
export function PropertyForm({ businessId, propertyId, desk = false }: { businessId?: string; propertyId?: string; desk?: boolean }) {
  const rules = useLoad(staysRules, "stays");
  const facilities = useLoad(listFacilities, "facilities");
  const property = useLoad<PropertyDetail | null>(
    () => (propertyId ? (desk ? getProperty(propertyId) : vendorProperty(propertyId)) : Promise.resolve(null)),
    `${propertyId ?? "new"}|${desk}`,
  );
  const failed = rules.error ?? facilities.error ?? property.error;
  if (rules.data && facilities.data && (!propertyId || property.data)) {
    const mode: Mode =
      !propertyId || !property.data
        ? { kind: "new", businessId: businessId! }
        : desk
          ? { kind: "desk", property: property.data }
          : { kind: "vendor", property: property.data as VendorProperty };
    return <Form rules={rules.data} facilities={facilities.data} mode={mode} />;
  }
  if (failed)
    return (
      <Failed
        error={failed}
        onRetry={() => {
          rules.reload();
          facilities.reload();
          property.reload();
        }}
      />
    );
  return <Loading rows={6} />;
}
