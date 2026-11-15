"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button, Icon, Input } from "@/components/ui";
import { Back, Failed, Loading, TextArea } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { formError } from "@/lib/api/account";
import { ApiError, newIdempotencyKey } from "@/lib/api/client";
import { createGround, turfRules, updateGround, vendorGround, type Amenity, type GroundInput, type Point, type TurfRulesView, type VendorGround } from "@/lib/api/turf";
import { AMENITIES, AMENITY_LABEL, groundTiers, refundLine } from "@/lib/turf";
import vendor from "@/components/vendor/vendor.module.css";

interface Draft {
  name: string;
  description: string;
  address: string;
  city: string;
  pincode: string;
  point: Point | null;
  amenities: Amenity[];
  fullHours: string;
  halfHours: string;
}

const whole = (text: string) => (/^\d+$/.test(text.trim()) ? Number(text.trim()) : null);

function draftOf(rules: TurfRulesView, ground?: VendorGround): Draft {
  return {
    name: ground?.name ?? "",
    description: ground?.description ?? "",
    address: ground?.venue.address ?? "",
    city: ground?.venue.city ?? "",
    pincode: ground?.venue.pincode ?? "",
    point: ground?.venue.point ?? null,
    amenities: ground?.amenities ?? [],
    fullHours: String(ground?.refunds.fullHours ?? rules.refundFullHours),
    halfHours: String(ground?.refunds.halfHours ?? rules.refundHalfHours),
  };
}

function errorsOf(d: Draft, rules: TurfRulesView): Record<string, string> {
  const e: Record<string, string> = {};
  if (d.name.trim().length < 2) e.name = "At least 2 characters";
  if (d.address.trim().length < 5) e.address = "Street and area, so players find it";
  if (d.city.trim().length < 2) e.city = "The city";
  if (d.pincode.trim() && !/^[1-9]\d{5}$/.test(d.pincode.trim())) e.pincode = "6 digits, or leave it empty";
  const full = whole(d.fullHours);
  const half = whole(d.halfHours);
  if (full === null || full < rules.minFullHours || full > rules.maxFullHours) e.fullHours = `From ${rules.minFullHours} to ${rules.maxFullHours} hours`;
  if (half === null || (full !== null && half > full)) e.halfHours = "No more than the full refund hours";
  return e;
}

function inputOf(d: Draft): GroundInput {
  return {
    name: d.name.trim(),
    description: d.description.trim() || null,
    venue: { address: d.address.trim(), city: d.city.trim(), pincode: d.pincode.trim() || null, point: d.point },
    amenities: d.amenities,
    refunds: { fullHours: Number(d.fullHours), halfHours: Number(d.halfHours) },
  };
}

function Form({ rules, ground, businessId }: { rules: TurfRulesView; ground?: VendorGround; businessId?: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => draftOf(rules, ground));
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const attempt = useRef(newIdempotencyKey());
  const errors = errorsOf(draft, rules);
  const err = (field: string) => (shown ? errors[field] : undefined);
  const back = ground ? `/vendor/grounds/${ground.id}` : `/vendor/businesses/${businessId}/grounds`;
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const toggleAmenity = (a: Amenity) => set("amenities", draft.amenities.includes(a) ? draft.amenities.filter((x) => x !== a) : [...draft.amenities, a]);
  const full = whole(draft.fullHours);
  const half = whole(draft.halfHours);

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
      const body = inputOf(draft);
      if (ground) {
        await updateGround(ground.id, body);
        router.push(`/vendor/grounds/${ground.id}`);
      } else {
        const created = await createGround(businessId!, body, attempt.current);
        router.replace(`/vendor/grounds/${created.id}?fresh=1`);
      }
    } catch (e) {
      setFailure(formError(e).message);
      if (!(e instanceof ApiError && e.code === "NETWORK")) attempt.current = newIdempotencyKey();
      setBusy(false);
    }
  };

  return (
    <div className={vendor.page}>
      <Back href={back}>{ground ? "Ground" : "Grounds"}</Back>
      <h1 className={vendor.title}>{ground ? "Edit ground" : "New ground"}</h1>
      <form
        className={vendor.form}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Input label="Ground name" value={draft.name} onChange={(e) => set("name", e.target.value)} maxLength={80} placeholder="Like “Kickoff Arena, Madhapur”" error={err("name")} />
        <TextArea
          label="About the ground (optional)"
          value={draft.description}
          onChange={(v) => set("description", v)}
          max={2000}
          placeholder="The surface, the size of each court, how to find the entrance"
        />
        <Input label="Address" value={draft.address} onChange={(e) => set("address", e.target.value)} maxLength={300} placeholder="Building, street, area" error={err("address")} />
        <div className={vendor.pair} data-even>
          <Input label="City" value={draft.city} onChange={(e) => set("city", e.target.value)} maxLength={60} autoComplete="address-level2" error={err("city")} />
          <Input
            label="PIN code (optional)"
            inputMode="numeric"
            value={draft.pincode}
            onChange={(e) => set("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))}
            autoComplete="postal-code"
            error={err("pincode")}
          />
        </div>
        <div className={vendor.field}>
          <span className={vendor.label}>Map pin (optional)</span>
          <p className={vendor.faint}>{draft.point ? `Pinned at ${draft.point.lat}, ${draft.point.lng}. Players get directions to it.` : "Stand at the ground and pin it, so directions go to the gate."}</p>
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
          <span className={vendor.label} id="amenities-label">
            At the ground
          </span>
          <div className={vendor.chips} role="group" aria-labelledby="amenities-label">
            {AMENITIES.map((a) => (
              <button key={a} type="button" className={vendor.chip} aria-pressed={draft.amenities.includes(a)} onClick={() => toggleAmenity(a)}>
                {AMENITY_LABEL[a]}
              </button>
            ))}
          </div>
        </div>

        <div className={vendor.field}>
          <span className={vendor.label}>Refunds when players cancel</span>
          <div className={vendor.pair} data-even>
            <Input
              label="Full refund from (hours before)"
              inputMode="numeric"
              value={draft.fullHours}
              onChange={(e) => set("fullHours", e.target.value.replace(/\D/g, "").slice(0, 3))}
              error={err("fullHours")}
            />
            <Input
              label={`${rules.halfPercent}% back from (hours before)`}
              inputMode="numeric"
              value={draft.halfHours}
              onChange={(e) => set("halfHours", e.target.value.replace(/\D/g, "").slice(0, 3))}
              hint="The same as the full refund hours for no part refund"
              error={err("halfHours")}
            />
          </div>
          {full !== null && half !== null && half <= full && (
            <p className={vendor.faint}>{`Players read: “${refundLine(groundTiers({ fullHours: full, halfHours: half, halfPercent: rules.halfPercent }))}” If you cancel, they get everything back.`}</p>
          )}
          {ground && ground.upcoming > 0 && <p className={vendor.faint}>Bookings already made keep the refund rule they were made with.</p>}
        </div>

        {failure && (
          <p className={vendor.error} role="alert">
            {failure}
          </p>
        )}
        {!ground && <p className={vendor.faint}>It’s saved as a draft. Add photos and courts, then publish it from the next screen.</p>}
        <div className={vendor.actions}>
          <Button type="submit" size="lg" loading={busy}>
            {ground ? "Save changes" : "Save as draft"}
          </Button>
        </div>
      </form>
    </div>
  );
}

/** Making a ground for `businessId` or changing `groundId`: name, venue, amenities and refund hours. A new ground is a draft. */
export function GroundForm({ businessId, groundId }: { businessId?: string; groundId?: string }) {
  const rules = useLoad(() => turfRules(), "turf");
  const ground = useLoad(() => (groundId ? vendorGround(groundId) : Promise.resolve(null)), groundId ?? "new");
  const failed = rules.error ?? ground.error;
  if (rules.data && (!groundId || ground.data)) return <Form rules={rules.data} ground={ground.data ?? undefined} businessId={businessId} />;
  if (failed)
    return (
      <Failed
        error={failed}
        onRetry={() => {
          rules.reload();
          ground.reload();
        }}
      />
    );
  return <Loading rows={4} />;
}
