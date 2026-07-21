"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useBusinessCatalog } from "@/lib/swr-hooks";
import {
  findBusinessType,
  findCategory,
  moduleLabel,
  typesForCategory,
} from "@/lib/business-types";
import {
  bookingModeLabel,
  needsBookingModeOnCreate,
  type BookingMode,
} from "@/lib/business-setup";
import { compressImageForUpload } from "@/lib/compress-image";
import { INDIAN_STATES, reverseGeocode, dedupeAddressParts } from "@/lib/india-locations";
import { citiesForState } from "@/lib/india-cities";

const CITY_OTHER = "__other__";

const input = "field-input";

const emptyBusinessForm = {
  name: "",
  phone: "",
  state: "",
  city: "",
  doorNo: "",
  building: "",
  street: "",
  locality: "",
  pincode: "",
  description: "",
};

function composeAddress(form: {
  doorNo: string;
  building: string;
  street: string;
  locality: string;
  city: string;
  state: string;
  pincode?: string;
}): string {
  return dedupeAddressParts(
    form.doorNo,
    form.building,
    form.street,
    form.locality,
    form.city,
    form.state,
    form.pincode,
  );
}

export type BusinessOnboardResult = {
  typeId: string;
  name: string;
  phone: string;
  address: string;
  description: string;
  thumbnail: string;
  bookingMode?: BookingMode;
};

type Props = {
  onClose: () => void;
  onComplete: (data: BusinessOnboardResult) => void;
  saving?: boolean;
};

type Step = "category" | "type" | "booking" | "details";

function stepsForType(typeId: string | null): Step[] {
  const steps: Step[] = ["category", "type"];
  if (typeId && needsBookingModeOnCreate(typeId)) steps.push("booking");
  steps.push("details");
  return steps;
}

const STEP_META: Record<Step, { label: string; hint: string }> = {
  category: { label: "Category", hint: "Choose the group that best fits your business." },
  type: { label: "Type", hint: "Pick the closest match — turf, salon, shop, etc." },
  booking: {
    label: "Booking style",
    hint: "How customers reserve your space — hourly slots or full days.",
  },
  details: {
    label: "Profile",
    hint: "Cover photo, name, location, and a short description.",
  },
};

function nameFieldLabel(typeLabel: string): string {
  return `${typeLabel} name`;
}

export function BusinessOnboardWizard({ onClose, onComplete, saving = false }: Props) {
  const [step, setStep] = useState<Step>("category");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [typeId, setTypeId] = useState<string | null>(null);
  const [bookingMode, setBookingMode] = useState<BookingMode | null>(null);
  const [form, setForm] = useState(emptyBusinessForm);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [thumbnailBusy, setThumbnailBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [canDismiss, setCanDismiss] = useState(false);
  const thumbInputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const { data: catalog, isLoading: catalogLoading, error: catalogError } = useBusinessCatalog();
  const categories = catalog?.categories ?? [];
  const moduleLabels = catalog?.modules ?? {};

  useEffect(() => {
    const shell = document.getElementById("vendor-shell");
    document.body.style.overflow = "hidden";
    shell?.classList.add("is-background-blurred");
    const dismissTimer = window.setTimeout(() => setCanDismiss(true), 200);
    return () => {
      window.clearTimeout(dismissTimer);
      document.body.style.overflow = "";
      shell?.classList.remove("is-background-blurred");
    };
  }, []);

  useEffect(() => {
    if (catalogError) {
      setError(
        catalogError instanceof Error ? catalogError.message : "Could not load business categories.",
      );
    }
  }, [catalogError]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [step]);

  const category = categoryId ? findCategory(categories, categoryId) : undefined;
  const businessType = typeId ? findBusinessType(categories, typeId) : undefined;
  const types = categoryId ? typesForCategory(categories, categoryId) : [];

  const steps = useMemo(() => stepsForType(typeId), [typeId]);
  const stepIndex = steps.indexOf(step);
  const currentStep = STEP_META[step];
  const stateCities = useMemo(() => citiesForState(form.state), [form.state]);
  const cityInList =
    Boolean(form.state && form.city && stateCities.includes(form.city));
  const showCustomCity =
    Boolean(form.state) &&
    (form.city === CITY_OTHER || (Boolean(form.city) && !cityInList));
  const citySelectValue = !form.state
    ? ""
    : cityInList
      ? form.city
      : showCustomCity
        ? CITY_OTHER
        : "";

  function detailsError(): string {
    if (!thumbnail) return "Cover photo is required.";
    if (!form.name.trim()) {
      return businessType ? `${nameFieldLabel(businessType.label)} is required.` : "Name is required.";
    }
    const phone = form.phone.trim();
    if (!phone) return "Phone number is required.";
    if (phone.length !== 10) return "Enter a valid 10-digit phone number.";
    if (!form.state.trim()) return "Select your state.";
    if (!form.city.trim()) return "Enter your city or town.";
    if (!form.description.trim()) return "Description is required.";
    return "";
  }

  async function onThumbnailPick(file: File | undefined) {
    if (!file?.type.startsWith("image/")) return;
    setThumbnailBusy(true);
    setError("");
    try {
      setThumbnail(await compressImageForUpload(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read image.");
    } finally {
      setThumbnailBusy(false);
      if (thumbInputRef.current) thumbInputRef.current.value = "";
    }
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

  function tryCreate() {
    if (!typeId || !businessType || !category) return;
    const detailErr = detailsError();
    if (detailErr) {
      setError(detailErr);
      return;
    }
    setError("");
    onSubmit();
  }

  function onSubmit() {
    if (!typeId || !businessType || !category) return;
    if (needsBookingModeOnCreate(typeId) && !bookingMode) {
      setError("Choose how customers book — hourly slots or full day.");
      setStep("booking");
      return;
    }
    const detailErr = detailsError();
    if (detailErr) {
      setError(detailErr);
      setStep("details");
      return;
    }
    onComplete({
      typeId,
      name: form.name.trim(),
      phone: form.phone.trim(),
      address: composeAddress(form),
      description: form.description.trim(),
      thumbnail: thumbnail!,
      ...(bookingMode ? { bookingMode } : {}),
    });
  }

  const stepTitle =
    step === "category"
      ? "What kind of business?"
      : step === "type"
        ? "What type exactly?"
        : step === "booking"
          ? "How will customers book?"
          : step === "details"
            ? "Add your business profile"
            : "";

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboard-wizard-title"
    >
      <div
        className="modal-backdrop"
        aria-hidden
        onClick={saving || !canDismiss ? undefined : onClose}
      />
      <div
        className="modal-panel flex min-h-[30rem] flex-col rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-white/8 bg-[#0c0c0e] px-5 py-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 pr-2">
              <p className="text-xs font-medium text-emerald-400">
                Step {stepIndex + 1} of {steps.length} · {currentStep.label}
              </p>
              <h2 id="onboard-wizard-title" className="mt-1 text-lg font-semibold text-white">
                {stepTitle}
              </h2>
              <p className="mt-1 text-sm text-zinc-400">{currentStep.hint}</p>
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
        </div>

        {/* Body */}
        <div
          ref={bodyRef}
          className={`min-h-[18rem] flex-1 px-5 py-4 ${
            step === "details" ? "max-h-[min(32rem,58vh)] overflow-y-auto" : ""
          }`}
        >
          {error && (
            <p className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-100">
              {error}
            </p>
          )}

          {catalogLoading ? (
            <div className="space-y-3">
              <p className="text-sm text-zinc-500">Loading categories…</p>
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <p className="text-sm text-zinc-400">
              No business categories are available right now. Please try again later.
            </p>
          ) : (
            <>
              {step === "category" && (
                <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setCategoryId(cat.id);
                        setTypeId(null);
                        setStep("type");
                      }}
                      className="rounded-2xl border border-white/10 bg-[#121214] p-3 text-left transition hover:border-emerald-500/40 hover:bg-[#18181b] active:scale-[0.98]"
                    >
                      <span className="text-xl">{cat.icon}</span>
                      <p className="mt-1.5 text-sm font-medium text-zinc-100">{cat.label}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500">{cat.description}</p>
                    </button>
                  ))}
                </div>
              )}

              {step === "type" && category && (
                <>
                  {types.length === 0 ? (
                    <p className="text-sm text-zinc-500">No types in this category yet.</p>
                  ) : (
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      {types.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setTypeId(t.id);
                            setBookingMode(null);
                            setStep(needsBookingModeOnCreate(t.id) ? "booking" : "details");
                          }}
                          className={`rounded-2xl border p-3 text-left transition active:scale-[0.99] ${
                            typeId === t.id
                              ? "border-emerald-500/50 bg-emerald-500/10"
                              : "border-white/8 bg-[#121214] hover:border-white/15 hover:bg-[#18181b]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-zinc-100">{t.label}</p>
                              <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500">{t.description}</p>
                            </div>
                            <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-zinc-400">
                              {moduleLabel(t.module, moduleLabels)}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              {step === "booking" && businessType && (
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      setBookingMode("slots");
                      setError("");
                      setStep("details");
                    }}
                    className={`rounded-2xl border p-4 text-left transition active:scale-[0.99] ${
                      bookingMode === "slots"
                        ? "border-sky-500/50 bg-sky-500/10"
                        : "border-white/8 bg-[#121214] hover:border-white/15 hover:bg-[#18181b]"
                    }`}
                  >
                    <p className="text-sm font-medium text-zinc-100">Hourly slots</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Customers book by the hour — turfs, courts, studios, short rentals.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBookingMode("fullDay");
                      setError("");
                      setStep("details");
                    }}
                    className={`rounded-2xl border p-4 text-left transition active:scale-[0.99] ${
                      bookingMode === "fullDay"
                        ? "border-violet-500/50 bg-violet-500/10"
                        : "border-white/8 bg-[#121214] hover:border-white/15 hover:bg-[#18181b]"
                    }`}
                  >
                    <p className="text-sm font-medium text-zinc-100">Full day</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      One booking per day — parties, weddings, events, full-day venue hire.
                    </p>
                  </button>
                </div>
              )}

              {step === "details" && businessType && category && (
                <div className="space-y-4">
                  <p className="text-sm text-zinc-400">
                    <span className="text-zinc-300">
                      {category.icon} {category.label}
                    </span>
                    <span className="text-zinc-600"> · </span>
                    <span className="text-zinc-300">{businessType.label}</span>
                    {bookingMode && (
                      <>
                        <span className="text-zinc-600"> · </span>
                        <span className="text-violet-300/80">{bookingModeLabel(bookingMode)}</span>
                      </>
                    )}
                  </p>

                  {/* Cover photo */}
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Cover photo <span className="text-red-400">*</span>
                    </p>
                    <label
                      className={`group relative mt-2 block aspect-[2.2/1] cursor-pointer overflow-hidden rounded-2xl border border-dashed transition ${
                        thumbnail
                          ? "border-white/15"
                          : "border-white/20 bg-white/[0.02] hover:border-emerald-500/40 hover:bg-emerald-500/[0.03]"
                      }`}
                    >
                      <input
                        ref={thumbInputRef}
                        type="file"
                        accept="image/*"
                        disabled={thumbnailBusy || saving}
                        className="sr-only"
                        onChange={(e) => void onThumbnailPick(e.target.files?.[0])}
                      />
                      {thumbnail ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={thumbnail}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                            <span className="rounded-full border border-white/20 bg-black/60 px-4 py-2 text-sm text-white">
                              {thumbnailBusy ? "Processing…" : "Change photo"}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-500">
                          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-xl">
                            {thumbnailBusy ? "…" : "📷"}
                          </span>
                          <span className="text-sm text-zinc-400">
                            {thumbnailBusy ? "Processing…" : "Tap to upload cover photo"}
                          </span>
                          <span className="text-xs text-zinc-600">Shown on your business card</span>
                        </div>
                      )}
                    </label>
                  </div>

                  {/* Name & phone */}
                  <div className="grid gap-3 sm:grid-cols-5">
                    <label className="block sm:col-span-3">
                      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        {nameFieldLabel(businessType.label)}{" "}
                        <span className="text-red-400">*</span>
                      </span>
                      <input
                        className={`${input} mt-1.5`}
                        value={form.name}
                        placeholder={businessType.namePlaceholder}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      />
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Phone number <span className="text-red-400">*</span>
                      </span>
                      <input
                        className={`${input} mt-1.5`}
                        inputMode="numeric"
                        placeholder="10-digit mobile"
                        value={form.phone}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                          }))
                        }
                      />
                    </label>
                  </div>

                  {/* Location */}
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Location <span className="text-red-400">*</span>
                      </p>
                      <button
                        type="button"
                        onClick={useCurrentLocation}
                        disabled={locating}
                        className="text-[11px] font-medium text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
                      >
                        {locating ? "Detecting…" : "📍 Use current location"}
                      </button>
                    </div>
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="text-xs text-zinc-500">State</span>
                        <select
                          className={`${input} mt-1`}
                          value={form.state}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, state: e.target.value, city: "" }))
                          }
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
                        <span className="text-xs text-zinc-500">
                          City / town
                          {form.state && stateCities.length > 0 && (
                            <span className="text-zinc-600"> · {stateCities.length} cities</span>
                          )}
                        </span>
                        <select
                          className={`${input} mt-1`}
                          value={citySelectValue}
                          disabled={!form.state}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === CITY_OTHER) {
                              setForm((f) => ({ ...f, city: "" }));
                              return;
                            }
                            setForm((f) => ({ ...f, city: value }));
                          }}
                        >
                          <option value="">
                            {!form.state
                              ? "Select state first"
                              : stateCities.length
                                ? "Select city"
                                : "No list — type below"}
                          </option>
                          {stateCities.map((city) => (
                            <option key={city} value={city}>
                              {city}
                            </option>
                          ))}
                          {form.state && (
                            <option value={CITY_OTHER}>Other — type manually</option>
                          )}
                        </select>
                      </label>
                      {(showCustomCity || (form.state && stateCities.length === 0)) && (
                        <label className="block sm:col-span-2">
                          <span className="text-xs text-zinc-500">Enter city / town</span>
                          <input
                            className={`${input} mt-1`}
                            placeholder="Your city or town name"
                            value={form.city}
                            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                          />
                        </label>
                      )}
                      <label className="block">
                        <span className="text-xs text-zinc-500">Door / flat / shop no.</span>
                        <input
                          className={`${input} mt-1`}
                          placeholder="e.g. 12, Shop 4, Flat 302"
                          value={form.doorNo}
                          onChange={(e) => setForm((f) => ({ ...f, doorNo: e.target.value }))}
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs text-zinc-500">Building / apartment</span>
                        <input
                          className={`${input} mt-1`}
                          placeholder="e.g. Sunshine Towers, ABC Complex"
                          value={form.building}
                          onChange={(e) => setForm((f) => ({ ...f, building: e.target.value }))}
                        />
                      </label>
                      <label className="block sm:col-span-2">
                        <span className="text-xs text-zinc-500">Street / road</span>
                        <input
                          className={`${input} mt-1`}
                          placeholder="e.g. 12th Main Road, MG Road"
                          value={form.street}
                          onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))}
                        />
                      </label>
                      <label className="block sm:col-span-2">
                        <span className="text-xs text-zinc-500">
                          Area / colony / ward
                        </span>
                        <input
                          className={`${input} mt-1`}
                          placeholder="e.g. HITEC City, Ward 107 Madhapur, Koramangala"
                          value={form.locality}
                          onChange={(e) => setForm((f) => ({ ...f, locality: e.target.value }))}
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs text-zinc-500">
                          Pincode <span className="text-zinc-600">(optional)</span>
                        </span>
                        <input
                          className={`${input} mt-1`}
                          inputMode="numeric"
                          placeholder="6-digit PIN"
                          maxLength={6}
                          value={form.pincode}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              pincode: e.target.value.replace(/\D/g, "").slice(0, 6),
                            }))
                          }
                        />
                      </label>
                    </div>
                    {(form.state || form.city || form.locality || form.street || form.pincode) && (
                      <p className="mt-2 text-xs leading-relaxed text-emerald-400">
                        <span className="font-medium">Full address: </span>
                        {composeAddress(form)}
                      </p>
                    )}
                  </div>

                  {/* Description */}
                  <label className="block">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Description <span className="text-red-400">*</span>
                      </span>
                      <span className="text-[11px] text-zinc-600">
                        {form.description.trim().length}/500
                      </span>
                    </div>
                    <textarea
                      className={`${input} mt-1.5 min-h-[4.5rem] resize-none`}
                      placeholder="What you offer — keep it short and clear for customers"
                      maxLength={500}
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    />
                  </label>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer — fixed height keeps wizard size consistent */}
        <div className="flex min-h-[3.75rem] shrink-0 items-center justify-between border-t border-white/8 bg-[#0c0c0e] px-5 py-3.5">
          {step === "details" && (
            <button
              type="button"
              onClick={() => {
                setError("");
                setStep(typeId && needsBookingModeOnCreate(typeId) ? "booking" : "type");
              }}
              disabled={catalogLoading}
              className="rounded-full border border-white/10 px-5 py-2.5 text-sm text-zinc-300 hover:bg-white/5 disabled:opacity-50"
            >
              ← Back
            </button>
          )}
          {step === "booking" && (
            <button
              type="button"
              onClick={() => {
                setError("");
                setStep("type");
              }}
              disabled={catalogLoading}
              className="rounded-full border border-white/10 px-5 py-2.5 text-sm text-zinc-300 hover:bg-white/5 disabled:opacity-50"
            >
              ← Back
            </button>
          )}
          <div className="flex-1" />
          {step === "details" && (
            <button
              type="button"
              onClick={tryCreate}
              disabled={saving || catalogLoading}
              className="btn-primary rounded-full px-6 py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              {saving ? "Creating…" : "Create business"}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
