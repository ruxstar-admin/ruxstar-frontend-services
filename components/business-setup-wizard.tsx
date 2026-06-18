"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Business, BusinessResource, BusinessSetupInput, WeeklyHours } from "@/lib/api";
import {
  completeBusinessSetup,
  getBusinessSetup,
  syncBusinessSetupPhotos,
  updateBusinessSetup,
} from "@/lib/api";
import { invalidateBusinesses, invalidatePublicBusinesses } from "@/lib/swr-hooks";
import { SetupStepFullDayDays } from "@/components/business-setup/setup-step-full-day-days";
import { SetupStepHourlySlots } from "@/components/business-setup/setup-step-hourly-slots";
import { SetupStepPhotos } from "@/components/business-setup/setup-step-photos";
import { SetupStepResources } from "@/components/business-setup/setup-step-resources";
import { SetupStepReview } from "@/components/business-setup/setup-step-review";
import { SetupStepRules } from "@/components/business-setup/setup-step-rules";
import {
  applyFullDayHours,
  bookingModeLabel,
  needsBookingModeOnCreate,
  priceLabel,
  resourceBasePrice,
  SETUP_DAYS,
  type BookingMode,
} from "@/lib/business-setup";
import {
  resolveSetupFlow,
  type SetupStepConfig,
  type SetupStepId,
} from "@/lib/business-setup-flows";
import { compressImageForUpload } from "@/lib/compress-image";

type Props = {
  business: Business;
  editMode?: boolean;
  onComplete: (business: Business) => void;
};

export function BusinessSetupWizard({ business, editMode = false, onComplete }: Props) {
  const setup = business.setup!;
  const bookingMode: BookingMode = setup.bookingMode === "fullDay" ? "fullDay" : "slots";
  const flow = useMemo(
    () => resolveSetupFlow(business.typeId, bookingMode),
    [business.typeId, bookingMode],
  );
  const isFullDay = bookingMode === "fullDay";

  const [stepIndex, setStepIndex] = useState(0);
  const currentStep: SetupStepConfig = flow.steps[stepIndex] ?? flow.steps[0];
  const step = currentStep.id;

  const [maxGuests, setMaxGuests] = useState(
    setup.maxGuests && setup.maxGuests > 0 ? String(setup.maxGuests) : "",
  );
  const [venueRules, setVenueRules] = useState(setup.venueRules ?? "");
  const [weeklyHours, setWeeklyHours] = useState<WeeklyHours>(setup.weeklyHours);
  const [slotMinutes, setSlotMinutes] = useState(setup.slotMinutes);
  const [resources, setResources] = useState<BusinessResource[]>(() =>
    setup.resources.map((r) => ({
      ...r,
      pricePerSlot: r.pricePerSlot ?? (setup.pricePerSlot > 0 ? setup.pricePerSlot : undefined),
    })),
  );
  const [savedPhotos, setSavedPhotos] = useState(setup.photos);
  const [pendingPhotos, setPendingPhotos] = useState<{ id: string; preview: string }[]>([]);
  const [removedPhotoIds, setRemovedPhotoIds] = useState<string[]>([]);
  const [resourceName, setResourceName] = useState("");
  const [resourcePrice, setResourcePrice] = useState("");
  const [resourceCapacity, setResourceCapacity] = useState("");
  const [resourceDescription, setResourceDescription] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const showRules = flow.steps.some((s) => s.id === "rules");
  const openDays = SETUP_DAYS.filter((d) => !weeklyHours[d].closed);
  const hoursRefDay = openDays[0] ?? "mon";

  const displayPhotos = [
    ...savedPhotos
      .filter((p) => !removedPhotoIds.includes(p.id))
      .map((p) => ({ id: p.id, url: p.url, pending: false })),
    ...pendingPhotos.map((p) => ({ id: p.id, url: p.preview, pending: true })),
  ];

  function goBack() {
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
  }

  function goNext() {
    if (stepIndex < flow.steps.length - 1) setStepIndex(stepIndex + 1);
  }

  function goToStep(id: SetupStepId) {
    const i = flow.steps.findIndex((s) => s.id === id);
    if (i >= 0) setStepIndex(i);
  }

  async function onPickPhotos(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    const room = 3 - displayPhotos.length;
    if (room <= 0) return;
    try {
      const next: { id: string; preview: string }[] = [];
      for (const file of Array.from(files).slice(0, room)) {
        if (!file.type.startsWith("image/")) continue;
        const preview = await compressImageForUpload(file);
        next.push({ id: crypto.randomUUID(), preview });
      }
      if (next.length) setPendingPhotos((prev) => [...prev, ...next]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read image.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function onRemovePhoto(photo: { id: string; pending: boolean }) {
    setError("");
    if (photo.pending) {
      setPendingPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      return;
    }
    setRemovedPhotoIds((prev) => (prev.includes(photo.id) ? prev : [...prev, photo.id]));
  }

  function resourcesHavePrices() {
    return (
      resources.length > 0 &&
      resources.every((r) => {
        const p = Number(r.pricePerSlot);
        return Number.isFinite(p) && p >= 0;
      })
    );
  }

  function buildSetupPatch(): BusinessSetupInput {
    const guests = maxGuests.trim() ? Math.round(Number(maxGuests)) : null;
    const prices = resources.map((r) => resourceBasePrice(r, setup.pricePerSlot));
    const patch: BusinessSetupInput = {
      weeklyHours: isFullDay ? applyFullDayHours(weeklyHours) : weeklyHours,
      pricePerSlot: prices.length ? Math.min(...prices) : 0,
      resources,
    };
    if (!isFullDay) patch.slotMinutes = slotMinutes;
    if (showRules) {
      patch.maxGuests = guests;
      patch.venueRules = venueRules.trim();
    }
    return patch;
  }

  async function syncPhotosIfNeeded() {
    if (!pendingPhotos.length && !removedPhotoIds.length) return;
    const latest = await syncBusinessSetupPhotos(business.id, {
      images: pendingPhotos.map((p) => p.preview),
      removeIds: removedPhotoIds,
    });
    setSavedPhotos(latest.setup?.photos ?? []);
    setPendingPhotos([]);
    setRemovedPhotoIds([]);
  }

  async function saveRulesAndContinue() {
    setBusy(true);
    setError("");
    try {
      const guests = maxGuests.trim() ? Math.round(Number(maxGuests)) : null;
      if (guests != null && (!Number.isFinite(guests) || guests < 1)) {
        setError("Enter a valid maximum guest count, or leave it blank.");
        return;
      }
      await updateBusinessSetup(business.id, {
        maxGuests: guests,
        venueRules: venueRules.trim(),
      });
      goNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save rules.");
    } finally {
      setBusy(false);
    }
  }

  async function savePhotosAndContinue() {
    setBusy(true);
    setError("");
    try {
      await syncPhotosIfNeeded();
      goNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save photos.");
    } finally {
      setBusy(false);
    }
  }

  async function saveHourlySlotsAndContinue() {
    setBusy(true);
    setError("");
    try {
      const updated = await updateBusinessSetup(business.id, {
        weeklyHours,
        slotMinutes,
      });
      if (updated.setup) {
        setWeeklyHours(updated.setup.weeklyHours);
        setSlotMinutes(updated.setup.slotMinutes);
      }
      goNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save hours.");
    } finally {
      setBusy(false);
    }
  }

  async function saveFullDayDaysAndContinue() {
    setBusy(true);
    setError("");
    try {
      if (openDays.length === 0) {
        setError("Select at least one open day.");
        return;
      }
      const normalized = applyFullDayHours(weeklyHours);
      const updated = await updateBusinessSetup(business.id, {
        weeklyHours: normalized,
      });
      if (updated.setup) {
        setWeeklyHours(updated.setup.weeklyHours);
      }
      goNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save days.");
    } finally {
      setBusy(false);
    }
  }

  async function saveResourcesAndContinue() {
    if (!resources.length) {
      setError("Add at least one before continuing.");
      return;
    }
    if (!resourcesHavePrices()) {
      setError(`Each item needs a ${priceLabel(bookingMode).toLowerCase()}.`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await updateBusinessSetup(business.id, { resources });
      goNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function persistEverything() {
    await syncPhotosIfNeeded();
    await updateBusinessSetup(business.id, buildSetupPatch());
  }

  async function onFinish() {
    setBusy(true);
    setError("");
    try {
      if (!resources.length) {
        setError("Add at least one bookable space.");
        goToStep("resources");
        return;
      }
      if (!resourcesHavePrices()) {
        setError(`Set a ${priceLabel(bookingMode).toLowerCase()} for each hall or court.`);
        goToStep("resources");
        return;
      }
      if (openDays.length === 0) {
        setError("Select at least one open day.");
        goToStep(isFullDay ? "full-day-days" : "hourly-slots");
        return;
      }

      await persistEverything();

      if (editMode) {
        const fresh = await getBusinessSetup(business.id);
        invalidateBusinesses();
        invalidatePublicBusinesses();
        onComplete(fresh);
        return;
      }

      const updated = await completeBusinessSetup(business.id);
      invalidateBusinesses();
      invalidatePublicBusinesses();
      onComplete(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save setup.");
    } finally {
      setBusy(false);
    }
  }

  function addResource() {
    const name = resourceName.trim();
    if (!name) return;
    const price = resourcePrice.trim() ? Math.round(Number(resourcePrice)) : NaN;
    if (!Number.isFinite(price) || price < 0) {
      setError(`Enter a valid ${priceLabel(bookingMode).toLowerCase()}.`);
      return;
    }
    const capacity = resourceCapacity.trim() ? Math.round(Number(resourceCapacity)) : undefined;
    if (capacity != null && (!Number.isFinite(capacity) || capacity < 1)) {
      setError("Enter a valid capacity, or leave it blank.");
      return;
    }
    const showHallFields = currentStep.props?.showHallFields ?? false;
    setResources((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name,
        pricePerSlot: price,
        ...(showHallFields && capacity ? { capacity } : {}),
        ...(showHallFields && resourceDescription.trim()
          ? { description: resourceDescription.trim() }
          : {}),
      },
    ]);
    setResourceName("");
    setResourcePrice("");
    setResourceCapacity("");
    setResourceDescription("");
    setError("");
  }

  function toggleDayOpen(day: (typeof SETUP_DAYS)[number]) {
    setWeeklyHours((h) => ({
      ...h,
      [day]: { ...h[day], closed: !h[day].closed },
    }));
  }

  function setUniformHours(open: string, close: string) {
    setWeeklyHours((h) => {
      const next = { ...h };
      for (const day of SETUP_DAYS) {
        if (!next[day].closed) next[day] = { ...next[day], open, close };
      }
      return next;
    });
  }

  async function onContinue() {
    switch (step) {
      case "rules":
        await saveRulesAndContinue();
        break;
      case "photos":
        await savePhotosAndContinue();
        break;
      case "hourly-slots":
        await saveHourlySlotsAndContinue();
        break;
      case "full-day-days":
        await saveFullDayDaysAndContinue();
        break;
      case "resources":
        await saveResourcesAndContinue();
        break;
      case "review":
        await onFinish();
        break;
    }
  }

  const resourceStep = flow.steps.find((s) => s.id === "resources");
  const resourceLabel = resourceStep?.label ?? "Resources";
  const showHallFields = resourceStep?.props?.showHallFields ?? false;

  const stepTitle =
    step === "rules"
      ? "House rules"
      : step === "photos"
        ? "Gallery photos"
        : step === "hourly-slots"
          ? "Hours & pricing"
          : step === "full-day-days"
            ? "Open days & price"
            : step === "resources"
              ? resourceLabel
              : step === "review"
                ? editMode
                  ? "Review changes"
                  : "Review & go live"
                : currentStep.label;

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [stepIndex]);

  return (
    <div className="glass flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-2xl">
      <div className="shrink-0 border-b border-white/8 bg-[#0c0c0e] px-5 py-3.5 sm:px-6">
        <p className="text-xs font-medium text-emerald-400">
          Step {stepIndex + 1} of {flow.steps.length} · {currentStep.label}
        </p>
        <h2 className="mt-1 text-lg font-semibold text-white">{stepTitle}</h2>
        <p className="mt-1 text-sm text-zinc-400">{currentStep.intro}</p>
        <p className="mt-1 truncate text-xs text-zinc-600">
          {business.name}
          {needsBookingModeOnCreate(business.typeId) && (
            <span> · {bookingModeLabel(bookingMode)}</span>
          )}
        </p>
      </div>

      <div ref={bodyRef} className="min-h-[14rem] flex-1 overflow-y-auto px-5 py-5 sm:px-6">
        {error && (
          <p className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-100">
            {error}
          </p>
        )}

        {step === "rules" && (
          <SetupStepRules
            intro=""
            variant={currentStep.props?.rulesVariant}
            maxGuests={maxGuests}
            venueRules={venueRules}
            onMaxGuestsChange={setMaxGuests}
            onVenueRulesChange={setVenueRules}
          />
        )}

        {step === "photos" && (
          <SetupStepPhotos
            intro=""
            photos={displayPhotos}
            busy={busy}
            fileRef={fileRef}
            onPick={onPickPhotos}
            onRemove={onRemovePhoto}
          />
        )}

        {step === "hourly-slots" && (
          <SetupStepHourlySlots
            intro=""
            weeklyHours={weeklyHours}
            slotMinutes={slotMinutes}
            hoursRefDay={hoursRefDay}
            onSlotMinutesChange={setSlotMinutes}
            onToggleDay={toggleDayOpen}
            onUniformHours={setUniformHours}
          />
        )}

        {step === "full-day-days" && (
          <SetupStepFullDayDays
            intro=""
            weeklyHours={weeklyHours}
            onToggleDay={toggleDayOpen}
          />
        )}

        {step === "resources" && (
          <SetupStepResources
            intro=""
            typeId={business.typeId}
            bookingMode={bookingMode}
            variant={currentStep.props?.resourcesVariant}
            showHallFields={currentStep.props?.showHallFields ?? false}
            resources={resources}
            resourceName={resourceName}
            resourcePrice={resourcePrice}
            resourceCapacity={resourceCapacity}
            resourceDescription={resourceDescription}
            onResourceNameChange={setResourceName}
            onResourcePriceChange={setResourcePrice}
            onResourceCapacityChange={setResourceCapacity}
            onResourceDescriptionChange={setResourceDescription}
            onAdd={addResource}
            onRemove={(id) => setResources((prev) => prev.filter((r) => r.id !== id))}
            onUpdate={(id, patch) =>
              setResources((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
            }
          />
        )}

        {step === "review" && (
          <SetupStepReview
            isFullDay={isFullDay}
            slotMinutes={slotMinutes}
            openDays={openDays}
            venueRules={venueRules}
            maxGuests={maxGuests}
            photos={displayPhotos}
            resources={resources}
            resourceLabel={resourceLabel}
            showRules={showRules}
            showHallFields={showHallFields}
          />
        )}
      </div>

      <div className="flex min-h-[3.75rem] shrink-0 items-center justify-between border-t border-white/8 bg-[#0c0c0e] px-5 py-3.5 sm:px-6">
        {stepIndex > 0 ? (
          <button
            type="button"
            disabled={busy}
            onClick={goBack}
            className="rounded-full border border-white/10 px-5 py-2.5 text-sm text-zinc-300 hover:bg-white/5 disabled:opacity-50"
          >
            ← Back
          </button>
        ) : (
          <div />
        )}
        <div className="flex-1" />
        <button
          type="button"
          disabled={busy}
          onClick={onContinue}
          className="btn-primary rounded-full px-6 py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          {busy
            ? "Saving…"
            : step === "review"
              ? editMode
                ? "Save & return"
                : "Go live"
              : step === "resources"
                ? "Review"
                : "Continue"}
        </button>
      </div>
    </div>
  );
}
