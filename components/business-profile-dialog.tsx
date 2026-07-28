"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { emptyAddressParts, updateBusiness, type Business, type BusinessAddressParts } from "@/lib/api";
import { INDIAN_STATES, reverseGeocode } from "@/lib/india-locations";
import { citiesForState } from "@/lib/india-cities";

const CITY_OTHER = "__other__";
const input = "field-input";

type Props = {
  business: Business;
  onClose: () => void;
  onSaved: (business: Business) => void;
};

type Form = BusinessAddressParts & {
  name: string;
  phone: string;
  description: string;
};

function initialForm(business: Business): Form {
  const parts = business.addressParts ?? emptyAddressParts();
  return {
    ...parts,
    name: business.name,
    phone: business.phone,
    description: business.description,
  };
}

/**
 * Edit the parts of a business profile that live outside the setup wizard.
 * These are the same fields the go-live gate checks, so a vendor blocked on
 * "add your address" can fix it without recreating the business.
 */
export function BusinessProfileDialog({ business, onClose, onSaved }: Props) {
  const [form, setForm] = useState<Form>(() => initialForm(business));
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const stateCities = useMemo(() => citiesForState(form.state), [form.state]);
  const cityInList = Boolean(form.state && form.city && stateCities.includes(form.city));
  const showCustomCity =
    Boolean(form.state) && (form.city === CITY_OTHER || (Boolean(form.city) && !cityInList));
  const citySelectValue = !form.state ? "" : cityInList ? form.city : showCustomCity ? CITY_OTHER : "";

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate(): string {
    if (!form.name.trim()) return "Business name is required.";
    const phone = form.phone.replace(/\D/g, "");
    if (phone.length !== 10) return "Enter a valid 10-digit phone number.";
    if (!form.state.trim()) return "Select your state.";
    if (!form.city.trim() || form.city === CITY_OTHER) return "Enter your city or town.";
    if (form.pincode && !/^\d{6}$/.test(form.pincode)) return "Pincode must be 6 digits.";
    if (!form.description.trim()) return "Description is required.";
    return "";
  }

  async function useCurrentLocation() {
    if (!("geolocation" in navigator)) {
      setError("Location is not available on this device — enter it manually.");
      return;
    }
    setLocating(true);
    setError("");
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }),
      );
      const loc = await reverseGeocode(position.coords.latitude, position.coords.longitude);
      setGeo({ lat: position.coords.latitude, lng: position.coords.longitude });
      setForm((f) => ({
        ...f,
        state: loc.state ?? f.state,
        city: loc.city ?? f.city,
        doorNo: loc.doorNo ?? "",
        building: loc.building ?? "",
        street: loc.street ?? "",
        locality: loc.locality ?? loc.addressLine ?? "",
        pincode: loc.pincode ?? "",
      }));
    } catch {
      setError("Could not detect your location — please enter it manually.");
    } finally {
      setLocating(false);
    }
  }

  async function onSave() {
    const problem = validate();
    if (problem) {
      setError(problem);
      bodyRef.current?.scrollTo({ top: 0 });
      return;
    }
    setSaving(true);
    setError("");
    try {
      const updated = await updateBusiness(business.id, {
        name: form.name.trim(),
        phone: form.phone.replace(/\D/g, ""),
        description: form.description.trim(),
        addressParts: {
          doorNo: form.doorNo.trim(),
          building: form.building.trim(),
          street: form.street.trim(),
          locality: form.locality.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          pincode: form.pincode.trim(),
        },
        ...(geo ? { geo } : {}),
      });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save changes.");
    } finally {
      setSaving(false);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="profile-dialog-title">
      <div className="modal-backdrop" aria-hidden onClick={saving ? undefined : onClose} />
      <div className="modal-panel flex max-h-[85vh] flex-col rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/8 bg-[#0c0c0e] px-5 py-3.5">
          <div className="min-w-0">
            <h2 id="profile-dialog-title" className="text-lg font-semibold text-white">
              Edit business details
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Name, contact, and location as customers see them.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="shrink-0 rounded-lg p-2 text-lg leading-none text-zinc-400 hover:bg-white/10 hover:text-zinc-200 disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <div ref={bodyRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {error && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-100">
              {error}
            </p>
          )}

          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Business name <span className="text-red-400">*</span>
            </span>
            <input
              className={`${input} mt-1.5`}
              value={form.name}
              maxLength={120}
              onChange={(e) => set("name", e.target.value)}
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Contact number <span className="text-red-400">*</span>
            </span>
            <input
              className={`${input} mt-1.5`}
              inputMode="numeric"
              maxLength={10}
              placeholder="10-digit mobile"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
            />
          </label>

          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Address <span className="text-red-400">*</span>
              </span>
              <button
                type="button"
                onClick={useCurrentLocation}
                disabled={locating}
                className="text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
              >
                {locating ? "Detecting…" : "Use my location"}
              </button>
            </div>

            <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs text-zinc-500">State</span>
                <select
                  className={`${input} mt-1`}
                  value={form.state}
                  onChange={(e) => setForm((f) => ({ ...f, state: e.target.value, city: "" }))}
                >
                  <option value="">Select state</option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs text-zinc-500">City / town</span>
                <select
                  className={`${input} mt-1`}
                  value={citySelectValue}
                  disabled={!form.state}
                  onChange={(e) => set("city", e.target.value)}
                >
                  <option value="">{form.state ? "Select city" : "Pick a state first"}</option>
                  {stateCities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  <option value={CITY_OTHER}>Other…</option>
                </select>
              </label>

              {showCustomCity && (
                <label className="block sm:col-span-2">
                  <span className="text-xs text-zinc-500">City name</span>
                  <input
                    className={`${input} mt-1`}
                    placeholder="Type your city or town"
                    value={form.city === CITY_OTHER ? "" : form.city}
                    onChange={(e) => set("city", e.target.value)}
                  />
                </label>
              )}

              <label className="block">
                <span className="text-xs text-zinc-500">Door / shop no.</span>
                <input
                  className={`${input} mt-1`}
                  value={form.doorNo}
                  onChange={(e) => set("doorNo", e.target.value)}
                />
              </label>

              <label className="block">
                <span className="text-xs text-zinc-500">Building</span>
                <input
                  className={`${input} mt-1`}
                  value={form.building}
                  onChange={(e) => set("building", e.target.value)}
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="text-xs text-zinc-500">Street / road</span>
                <input
                  className={`${input} mt-1`}
                  value={form.street}
                  onChange={(e) => set("street", e.target.value)}
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="text-xs text-zinc-500">Area / colony / ward</span>
                <input
                  className={`${input} mt-1`}
                  value={form.locality}
                  onChange={(e) => set("locality", e.target.value)}
                />
              </label>

              <label className="block">
                <span className="text-xs text-zinc-500">
                  Pincode <span className="text-zinc-600">(optional)</span>
                </span>
                <input
                  className={`${input} mt-1`}
                  inputMode="numeric"
                  maxLength={6}
                  value={form.pincode}
                  onChange={(e) => set("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
              </label>
            </div>
          </div>

          <label className="block">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Description <span className="text-red-400">*</span>
              </span>
              <span className="text-[11px] text-zinc-600">{form.description.trim().length}/500</span>
            </div>
            <textarea
              className={`${input} mt-1.5 min-h-[4.5rem] resize-none`}
              maxLength={500}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </label>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-white/8 bg-[#0c0c0e] px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-full border border-white/10 px-5 py-2.5 text-sm text-zinc-300 hover:bg-white/5 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="btn-primary rounded-full px-6 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
