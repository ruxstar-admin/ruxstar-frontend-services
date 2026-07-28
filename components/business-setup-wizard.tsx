"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Business,
  BusinessResource,
  BusinessService,
  BusinessSetupInput,
  BusinessStaff,
  PrintProfile,
  CommerceProfile,
  CreatorProfile,
  ValidationIssue,
  WeeklyHours,
} from "@/lib/api";
import { defaultPrintProfile, defaultCommerceProfile, defaultCreatorProfile, ValidationError } from "@/lib/api";
import {
  completeBusinessSetup,
  getBusinessSetup,
  syncBusinessSetupPhotos,
  updateBusinessSetup,
} from "@/lib/api";
import { invalidateBusinesses, invalidatePublicBusinesses, usePrintCatalog } from "@/lib/swr-hooks";
import { prettyCity } from "@/lib/cities";
import { SetupStepFullDayDays } from "@/components/business-setup/setup-step-full-day-days";
import { SetupStepHourlySlots } from "@/components/business-setup/setup-step-hourly-slots";
import { SetupStepPhotos } from "@/components/business-setup/setup-step-photos";
import { SetupStepResources } from "@/components/business-setup/setup-step-resources";
import { SetupStepReview } from "@/components/business-setup/setup-step-review";
import { SetupStepRules } from "@/components/business-setup/setup-step-rules";
import { SetupStepStaff } from "@/components/business-setup/setup-step-staff";
import { SetupStepServices } from "@/components/business-setup/setup-step-services";
import { SetupStepCoachingServices } from "@/components/business-setup/setup-step-coaching-services";
import { formatServicePriceSummary } from "@/lib/coaching";
import { SetupStepPrintProfile } from "@/components/business-setup/setup-step-print-profile";
import { SetupStepPrintPricing } from "@/components/business-setup/setup-step-print-pricing";
import { SetupStepCommerceProfile } from "@/components/business-setup/setup-step-commerce-profile";
import { SetupStepCreatorProfile } from "@/components/business-setup/setup-step-creator-profile";
import { SetupStepProducts } from "@/components/business-setup/setup-step-products";
import {
  applyFullDayHours,
  bookingModeLabel,
  isPrintType,
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
  const bookingMode: BookingMode =
    setup.bookingMode === "fullDay"
      ? "fullDay"
      : setup.bookingMode === "services"
        ? "services"
        : "slots";
  const flow = useMemo(
    () => resolveSetupFlow(business.typeId, bookingMode),
    [business.typeId, bookingMode],
  );
  const isFullDay = bookingMode === "fullDay";
  const isService = bookingMode === "services";
  const isCoaching = business.typeId === "coaching";
  const isPrint = business.module === "print" || isPrintType(business.typeId);
  const isCommerce = business.module === "commerce";
  const isCreator = business.module === "creator";

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
  const [staff, setStaff] = useState<BusinessStaff[]>(() => setup.staff ?? []);
  const [services, setServices] = useState<BusinessService[]>(() => setup.services ?? []);
  const [printProfile, setPrintProfile] = useState<PrintProfile>(
    () => setup.printProfile ?? defaultPrintProfile(),
  );
  const [commerceProfile, setCommerceProfile] = useState<CommerceProfile>(
    () => setup.commerceProfile ?? defaultCommerceProfile(),
  );
  const [creatorProfile, setCreatorProfile] = useState<CreatorProfile>(
    () => setup.creatorProfile ?? defaultCreatorProfile(),
  );
  const [productCount, setProductCount] = useState(
    () => setup.commerceProfile?.activeProductCount ?? 0,
  );
  const { data: printCatalog = [] } = usePrintCatalog(isPrint);
  const printCategoryLabels = useMemo(() => {
    const map = new Map(printCatalog.map((c) => [c.id, c.label]));
    return printProfile.serviceCategories.map((id) => map.get(id) ?? prettyCity(id.replace(/[-_]/g, " ")));
  }, [printCatalog, printProfile.serviceCategories]);
  const printCityLabels = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of printProfile.cities) {
      // Stored values may include a "city, district" form — show just the place.
      const place = raw.split(",")[0].trim();
      const label = prettyCity(place);
      const key = label.toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(label);
    }
    return out;
  }, [printProfile.cities]);
  const [savedPhotos, setSavedPhotos] = useState(setup.photos);
  const [pendingPhotos, setPendingPhotos] = useState<{ id: string; preview: string }[]>([]);
  const [removedPhotoIds, setRemovedPhotoIds] = useState<string[]>([]);
  const [resourceName, setResourceName] = useState("");
  const [resourcePrice, setResourcePrice] = useState("");
  const [resourceCapacity, setResourceCapacity] = useState("");
  const [resourceDescription, setResourceDescription] = useState("");
  const [bufferMinutes, setBufferMinutes] = useState(setup.bufferMinutes ?? 0);
  const [error, setError] = useState("");
  const [blockers, setBlockers] = useState<ValidationIssue[]>([]);
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
        return Number.isFinite(p) && p > 0;
      })
    );
  }

  function buildSetupPatch(): BusinessSetupInput {
    if (isPrint) {
      return { printProfile };
    }
    if (isCommerce) {
      return { commerceProfile };
    }
    if (isCreator) {
      return { creatorProfile };
    }
    if (isService) {
      return {
        weeklyHours,
        staff,
        services,
        bufferMinutes,
      };
    }
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

  function addStaff(name: string, role: string) {
    setStaff((prev) => [...prev, { id: crypto.randomUUID(), name, ...(role ? { role } : {}) }]);
    setError("");
  }

  function removeStaff(id: string) {
    setStaff((prev) => prev.filter((s) => s.id !== id));
    setServices((prev) =>
      prev.map((svc) => ({ ...svc, staffIds: svc.staffIds.filter((x) => x !== id) })),
    );
  }

  function addService(svc: {
    name: string;
    durationMinutes: number;
    price: number;
    pricingModel?: BusinessService["pricingModel"];
    enrollmentType?: BusinessService["enrollmentType"];
    maxParticipants?: number;
    classTimings?: BusinessService["classTimings"];
    priceOptions?: BusinessService["priceOptions"];
  }) {
    setServices((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: svc.name,
        durationMinutes: svc.durationMinutes,
        price: svc.price,
        staffIds: staff.map((s) => s.id),
        ...(svc.pricingModel && svc.pricingModel !== "per_session"
          ? { pricingModel: svc.pricingModel }
          : {}),
        ...(svc.enrollmentType && svc.enrollmentType !== "open"
          ? { enrollmentType: svc.enrollmentType }
          : {}),
        ...(svc.maxParticipants && svc.maxParticipants > 1
          ? { maxParticipants: svc.maxParticipants }
          : {}),
        ...(svc.classTimings?.length ? { classTimings: svc.classTimings } : {}),
        ...(svc.priceOptions && svc.priceOptions.length ? { priceOptions: svc.priceOptions } : {}),
      },
    ]);
    setError("");
  }

  function removeService(id: string) {
    setServices((prev) => prev.filter((s) => s.id !== id));
  }

  function toggleServiceStaff(serviceId: string, staffId: string) {
    setServices((prev) =>
      prev.map((svc) =>
        svc.id === serviceId
          ? {
              ...svc,
              staffIds: svc.staffIds.includes(staffId)
                ? svc.staffIds.filter((x) => x !== staffId)
                : [...svc.staffIds, staffId],
            }
          : svc,
      ),
    );
  }

  async function saveStaffAndContinue() {
    if (!staff.length) {
      setError("Add at least one before continuing.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await updateBusinessSetup(business.id, { staff });
      goNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save staff.");
    } finally {
      setBusy(false);
    }
  }

  async function saveServicesAndContinue() {
    if (!services.length) {
      setError("Add at least one service.");
      return;
    }
    const missing = services.find((svc) => svc.staffIds.length === 0);
    if (missing) {
      setError(`Assign at least one person to "${missing.name}".`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await updateBusinessSetup(business.id, { staff, services, bufferMinutes });
      goNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save services.");
    } finally {
      setBusy(false);
    }
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
    if (openDays.length === 0) {
      setError("Select at least one open day.");
      return;
    }
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

  async function savePrintProfileAndContinue() {
    if (!printProfile.serviceCategories.length) {
      setError("Select at least one print category you offer.");
      return;
    }
    if (!printProfile.serveAll && !printProfile.cities.length) {
      setError('Add at least one service city, or turn on "Serve everywhere".');
      return;
    }
    setBusy(true);
    setError("");
    try {
      await updateBusinessSetup(business.id, { printProfile });
      goNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  function printPricingError(): string | null {
    const byId = new Map(printCatalog.map((c) => [c.id, c]));
    for (const catId of printProfile.serviceCategories) {
      const cat = byId.get(catId);
      const label = cat?.label ?? catId;
      const pricing = printProfile.pricing[catId];
      if (!pricing || pricing.enabled === false) return `Set a price for "${label}".`;
      if (cat?.pricingModel === "per_page") {
        if (!((pricing.perPage?.bw ?? 0) > 0 || (pricing.perPage?.color ?? 0) > 0)) {
          return `Set a per-page price for "${label}".`;
        }
      } else if (!((pricing.basePrice ?? 0) > 0)) {
        return `Set a base price for "${label}".`;
      }
    }
    return null;
  }

  async function savePrintPricingAndContinue() {
    const err = printPricingError();
    if (err) {
      setError(err);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await updateBusinessSetup(business.id, { printProfile });
      goNext();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save pricing.");
    } finally {
      setBusy(false);
    }
  }

  async function saveCommerceProfileAndContinue() {
    setBusy(true);
    setError("");
    try {
      await updateBusinessSetup(business.id, { commerceProfile });
      goNext();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save shop details.");
    } finally {
      setBusy(false);
    }
  }

  async function saveCreatorProfileAndContinue() {
    setBusy(true);
    setError("");
    try {
      await updateBusinessSetup(business.id, { creatorProfile });
      goNext();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save creator profile.");
    } finally {
      setBusy(false);
    }
  }

  async function saveProductsAndContinue() {
    if (productCount < 1) {
      setError("Add at least one product before continuing.");
      return;
    }
    setError("");
    goNext();
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

  // Maps a go-live issue reported by the backend to the wizard step that fixes
  // it. `profile` issues (address, phone, description) live outside the wizard.
  function stepForIssue(issue: ValidationIssue): SetupStepId | null {
    switch (issue.step) {
      case "photos":
        return "photos";
      case "printProfile":
        return "print-profile";
      case "printPricing":
        return "print-pricing";
      case "products":
        return "products";
      case "commerceProfile":
        return "commerce-profile";
      case "creator-profile":
        return "creator-profile";
      case "staff":
        return "staff";
      case "services":
        return "services";
      case "resources":
        return "resources";
      case "hours":
        return isFullDay ? "full-day-days" : "hourly-slots";
      default:
        return null;
    }
  }

  function jumpToIssue(issue: ValidationIssue) {
    const target = stepForIssue(issue);
    if (!target) return;
    if (!flow.steps.some((s) => s.id === target)) return;
    setBlockers([]);
    setError("");
    goToStep(target);
  }

  async function onFinish() {
    setBusy(true);
    setError("");
    setBlockers([]);
    try {
      if (isPrint) {
        if (!printProfile.serviceCategories.length) {
          setError("Select at least one print category you offer.");
          goToStep("print-profile");
          return;
        }
        if (!printProfile.serveAll && !printProfile.cities.length) {
          setError('Add at least one service city, or turn on "Serve everywhere".');
          goToStep("print-profile");
          return;
        }
        const pricingErr = printPricingError();
        if (pricingErr) {
          setError(pricingErr);
          goToStep("print-pricing");
          return;
        }
      } else if (isCommerce) {
        if (productCount < 1) {
          setError("Add at least one product before going live.");
          goToStep("products");
          return;
        }
      } else if (isCreator) {
        if (!creatorProfile.bio.trim()) {
          setError("Add a bio before going live.");
          goToStep("creator-profile");
          return;
        }
        if (!creatorProfile.niche.trim()) {
          setError("Add your niche before going live.");
          goToStep("creator-profile");
          return;
        }
      } else if (isService) {
        if (openDays.length === 0) {
          setError("Select at least one open day.");
          goToStep("hourly-slots");
          return;
        }
        if (!staff.length) {
          setError("Add at least one staff member.");
          goToStep("staff");
          return;
        }
        if (!services.length) {
          setError("Add at least one service.");
          goToStep("services");
          return;
        }
        const missing = services.find((svc) => svc.staffIds.length === 0);
        if (missing) {
          setError(`Assign at least one person to "${missing.name}".`);
          goToStep("services");
          return;
        }
      } else {
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
      }

      await persistEverything();

      if (editMode) {
        const fresh = await getBusinessSetup(business.id);
        invalidateBusinesses();
        invalidatePublicBusinesses();
        // The backend takes a live listing offline when an edit breaks the
        // go-live gate — keep the wizard open so the vendor can fix it.
        if (business.status === "live" && fresh.status === "draft") {
          setBlockers(fresh.readiness?.issues ?? []);
          setError("Your changes were saved, but the listing is offline until these are fixed.");
          return;
        }
        onComplete(fresh);
        return;
      }

      const updated = await completeBusinessSetup(business.id);
      invalidateBusinesses();
      invalidatePublicBusinesses();
      onComplete(updated);
    } catch (err) {
      if (err instanceof ValidationError) {
        setBlockers(err.issues);
        setError("A few things are still missing before you can go live.");
      } else {
        setError(err instanceof Error ? err.message : "Could not save setup.");
      }
    } finally {
      setBusy(false);
    }
  }

  function addResource() {
    const name = resourceName.trim();
    if (!name) return;
    const price = resourcePrice.trim() ? Math.round(Number(resourcePrice)) : NaN;
    if (!Number.isFinite(price) || price <= 0) {
      setError(`Enter a ${priceLabel(bookingMode).toLowerCase()} above ₹0.`);
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
      case "staff":
        await saveStaffAndContinue();
        break;
      case "services":
        await saveServicesAndContinue();
        break;
      case "print-profile":
        await savePrintProfileAndContinue();
        break;
      case "print-pricing":
        await savePrintPricingAndContinue();
        break;
      case "commerce-profile":
        await saveCommerceProfileAndContinue();
        break;
      case "creator-profile":
        await saveCreatorProfileAndContinue();
        break;
      case "products":
        await saveProductsAndContinue();
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
              : step === "print-profile"
                ? "Products & service area"
                : step === "print-pricing"
                ? "Product pricing"
                : step === "commerce-profile"
                  ? "Shop details"
                  : step === "creator-profile"
                    ? "Creator profile"
                  : step === "products"
                    ? "Products"
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

        {blockers.length > 0 && (
          <ul className="mb-3 space-y-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {blockers.map((issue) => {
              const target = stepForIssue(issue);
              const canJump = Boolean(target) && flow.steps.some((s) => s.id === target);
              return (
                <li key={`${issue.step}:${issue.field}`} className="flex items-start gap-2">
                  <span aria-hidden className="mt-0.5">•</span>
                  {canJump ? (
                    <button
                      type="button"
                      onClick={() => jumpToIssue(issue)}
                      className="text-left underline underline-offset-2 hover:text-amber-50"
                    >
                      {issue.message}
                    </button>
                  ) : (
                    <span>{issue.message}</span>
                  )}
                </li>
              );
            })}
            {blockers.some((i) => i.step === "profile") && (
              <li className="pt-1 text-xs text-amber-200/80">
                Profile details are edited from My businesses → Edit details.
              </li>
            )}
          </ul>
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
            hideSlotLength={isService || currentStep.props?.hideSlotLength}
            onSlotMinutesChange={setSlotMinutes}
            onToggleDay={toggleDayOpen}
            onUniformHours={setUniformHours}
          />
        )}

        {step === "staff" && (
          <SetupStepStaff
            staff={staff}
            staffNoun={currentStep.props?.staffNoun ?? "staff member"}
            onAdd={addStaff}
            onRemove={removeStaff}
          />
        )}

        {step === "services" && (
          <div className="space-y-5">
            {isCoaching ? (
              <SetupStepCoachingServices
                services={services}
                staff={staff}
                onAdd={addService}
                onRemove={removeService}
                onToggleStaff={toggleServiceStaff}
              />
            ) : (
              <SetupStepServices
                services={services}
                staff={staff}
                onAdd={addService}
                onRemove={removeService}
                onToggleStaff={toggleServiceStaff}
              />
            )}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <label className="flex items-center justify-between gap-3 text-sm">
                <span className="text-zinc-300">Gap between appointments</span>
                <select
                  className="field-input w-32 py-2 text-sm"
                  value={bufferMinutes}
                  onChange={(e) => setBufferMinutes(Number(e.target.value))}
                >
                  {[0, 5, 10, 15, 20, 30].map((m) => (
                    <option key={m} value={m}>
                      {m === 0 ? "None" : `${m} min`}
                    </option>
                  ))}
                </select>
              </label>
              <p className="mt-1.5 text-xs text-zinc-600">
                Cleanup or buffer time held after each appointment.
              </p>
            </div>
          </div>
        )}

        {step === "print-profile" && (
          <SetupStepPrintProfile
            value={printProfile}
            onChange={(patch) => setPrintProfile((prev) => ({ ...prev, ...patch }))}
          />
        )}

        {step === "print-pricing" && (
          <SetupStepPrintPricing
            value={printProfile}
            onChange={(patch) => setPrintProfile((prev) => ({ ...prev, ...patch }))}
          />
        )}

        {step === "commerce-profile" && (
          <SetupStepCommerceProfile
            value={commerceProfile}
            onChange={(patch) => setCommerceProfile((prev) => ({ ...prev, ...patch }))}
          />
        )}

        {step === "creator-profile" && (
          <SetupStepCreatorProfile
            value={creatorProfile}
            onChange={(patch) => setCreatorProfile((prev) => ({ ...prev, ...patch }))}
          />
        )}

        {step === "products" && (
          <SetupStepProducts businessId={business.id} onCountChange={setProductCount} />
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

        {step === "review" && isCreator && (
          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Profile</p>
              <p className="mt-1 text-sm text-zinc-200">{creatorProfile.niche || "—"}</p>
              <p className="mt-2 line-clamp-4 text-sm text-zinc-400">
                {creatorProfile.bio.trim() || "No bio yet"}
              </p>
            </div>
            <p className="text-sm text-zinc-500">
              After going live, publish collab offers from your business card → Offers.
            </p>
          </div>
        )}

        {step === "review" && isCommerce && (
          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Products</p>
              <p className="mt-1 text-sm text-zinc-200">
                {productCount} product{productCount === 1 ? "" : "s"} listed
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Pickup</p>
              <p className="mt-1 text-sm text-zinc-200">
                {commerceProfile.notes.trim() || "No pickup notes"}
              </p>
              {commerceProfile.minOrderValue > 0 && (
                <p className="mt-1 text-xs text-zinc-500">
                  Min order ₹{commerceProfile.minOrderValue.toLocaleString("en-IN")}
                </p>
              )}
            </div>
          </div>
        )}

        {step === "review" && isPrint && (
          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Print categories ({printCategoryLabels.length})
              </p>
              {printCategoryLabels.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {printCategoryLabels.map((label) => (
                    <span
                      key={label}
                      className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-200"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-sm text-zinc-500">None selected</p>
              )}
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Service area
              </p>
              {printProfile.serveAll ? (
                <p className="mt-1 text-sm text-zinc-200">Everywhere (pan-India)</p>
              ) : printCityLabels.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {printCityLabels.map((label) => (
                    <span
                      key={label}
                      className="inline-flex items-center rounded-full bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-zinc-200"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-sm text-zinc-500">No cities set</p>
              )}
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Details</p>
              <p className="mt-1 text-sm text-zinc-200">
                Turnaround: {printProfile.turnaroundDays || 0} days
                {printProfile.minOrderValue > 0
                  ? ` · Min order ₹${printProfile.minOrderValue.toLocaleString("en-IN")}`
                  : ""}
              </p>
            </div>
          </div>
        )}

        {step === "review" && !isService && !isPrint && !isCommerce && !isCreator && (
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

        {step === "review" && isService && (
          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Open days</p>
              <p className="mt-1 text-sm text-zinc-200">
                {openDays.length ? openDays.join(", ") : "No days selected"}
                {bufferMinutes > 0 ? ` · ${bufferMinutes} min gap` : ""}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Team ({staff.length})
              </p>
              <p className="mt-1 text-sm text-zinc-200">
                {staff.map((s) => s.name).join(", ") || "None"}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Services ({services.length})
              </p>
              <ul className="mt-2 space-y-1.5">
                {services.map((svc) => (
                  <li key={svc.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-zinc-200">{svc.name}</span>
                    <span className="shrink-0 text-right text-zinc-500">
                      {isCoaching
                        ? formatServicePriceSummary(svc)
                        : `${svc.durationMinutes} min · ₹${svc.price.toLocaleString("en-IN")}`}
                    </span>
                  </li>
                ))}
                {services.length === 0 && <li className="text-sm text-zinc-600">None</li>}
              </ul>
            </div>
          </div>
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
