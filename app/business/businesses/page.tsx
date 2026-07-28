"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  BusinessOnboardWizard,
  type BusinessOnboardResult,
} from "@/components/business-onboard-wizard";
import { VendorOnboardPrompt } from "@/components/vendor-onboard-prompt";
import { BusinessProfileDialog } from "@/components/business-profile-dialog";
import { moduleLabel } from "@/lib/business-types";
import { useVendorShell } from "@/components/vendor-shell";
import {
  businessThumbnailUrl,
  createBusiness,
  deleteBusiness,
  publishBusiness,
  uploadBusinessThumbnail,
  ValidationError,
  type Business,
  type BusinessModule,
  type RuxEvent,
} from "@/lib/api";
import {
  invalidateBusinesses,
  useBusinessCatalog,
  useVendorBusinesses,
  useVendorEvents,
} from "@/lib/swr-hooks";
import {
  supportsAppointmentSetup,
  supportsEvents,
  supportsPrintSetup,
  supportsCommerceSetup,
  supportsCreatorSetup,
  supportsSetup,
} from "@/lib/business-setup";
import { BusinessThumbnail } from "@/components/business-thumbnail";
import { compressImageForUpload } from "@/lib/compress-image";

const MODULE_STYLES: Record<BusinessModule, string> = {
  events: "border-violet-500/25 bg-violet-500/10 text-violet-200",
  appointments: "border-sky-500/25 bg-sky-500/10 text-sky-200",
  services: "border-amber-500/25 bg-amber-500/10 text-amber-200",
  commerce: "border-emerald-500/25 bg-emerald-500/10 text-emerald-200",
  creator: "border-pink-500/25 bg-pink-500/10 text-pink-200",
  print: "border-orange-500/25 bg-orange-500/10 text-orange-200",
};

type StatusFilter = "all" | "live" | "offline" | "setup" | "soon";

// An events business has nothing public until it publishes an event, so its
// status comes from its events rather than from `setupComplete`.
function businessStatusKey(biz: Business, events: RuxEvent[]): Exclude<StatusFilter, "all"> {
  if (supportsEvents(biz.module)) {
    return events.some((e) => e.status === "published") ? "live" : "setup";
  }
  if (biz.setupComplete) return biz.status === "live" ? "live" : "offline";
  if (supportsSetup(biz.module, biz.typeId)) return "setup";
  return "soon";
}

const STATUS_BADGES: Record<Exclude<StatusFilter, "all">, { label: string; className: string }> = {
  live: { label: "Live", className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-200" },
  offline: { label: "Offline", className: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300" },
  setup: { label: "Needs setup", className: "border-amber-500/25 bg-amber-500/10 text-amber-200" },
  soon: { label: "Coming soon", className: "border-white/15 bg-white/5 text-zinc-300" },
};

const filterSelect = "field-input h-10 w-full py-0 text-sm";
const toolbarBtn =
  "btn-primary inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-full px-4 text-sm font-semibold sm:px-5";
const cardActionBtn =
  "btn-primary inline-flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-full px-3.5 text-xs font-semibold sm:px-4";

function businessAction(biz: Business, events: RuxEvent[]) {
  if (biz.setupComplete && supportsAppointmentSetup(biz.module)) {
    return {
      href: `/business/businesses/${biz.id}/calendar`,
      label: biz.typeId === "coaching" ? "View classes" : "View calendar",
      disabled: false,
    };
  }
  if (supportsPrintSetup(biz.module, biz.typeId)) {
    if (biz.setupComplete) {
      return { href: "/business/print-orders", label: "Orders", disabled: false };
    }
    return {
      href: `/business/businesses/${biz.id}/setup`,
      label: "Finish setup",
      disabled: false,
    };
  }
  if (supportsCommerceSetup(biz.module)) {
    if (biz.setupComplete) {
      return { href: "/business/commerce-orders", label: "Orders", disabled: false };
    }
    return {
      href: `/business/businesses/${biz.id}/setup`,
      label: "Finish setup",
      disabled: false,
    };
  }
  if (supportsCreatorSetup(biz.module)) {
    if (biz.setupComplete) {
      return { href: `/business/businesses/${biz.id}/offers`, label: "Offers", disabled: false };
    }
    return {
      href: `/business/businesses/${biz.id}/setup`,
      label: "Finish setup",
      disabled: false,
    };
  }
  if (supportsAppointmentSetup(biz.module)) {
    return {
      href: `/business/businesses/${biz.id}/setup`,
      label: "Finish setup",
      disabled: false,
    };
  }
  if (supportsEvents(biz.module)) {
    // No event yet → set one up. Otherwise open it directly (edit +
    // registrations), like an appointments business opens its calendar.
    if (events.length === 0) {
      return {
        href: `/business/businesses/${biz.id}/events/new`,
        label: "Set up event",
        disabled: false,
      };
    }
    return {
      href: `/business/businesses/${biz.id}/events/${events[0].id}`,
      label: "Manage registrations",
      disabled: false,
    };
  }
  return {
    href: null,
    label: "Setup coming soon",
    disabled: true,
  };
}

const removeBtnClass =
  "inline-flex h-8 items-center rounded-full border border-white/15 bg-white/5 px-3.5 text-xs font-medium text-zinc-300 transition hover:bg-white/10 hover:text-white disabled:opacity-50";

export default function VendorBusinessesPage() {
  const router = useRouter();
  const { kycVerified, kyc } = useVendorShell();

  const {
    data: businesses = [],
    isLoading: loading,
    error: fetchError,
    mutate: mutateBusinesses,
  } = useVendorBusinesses(kycVerified);
  const { data: vendorEvents = [] } = useVendorEvents(kycVerified);
  const { data: catalog } = useBusinessCatalog();
  const moduleLabels = catalog?.modules ?? {};

  const [showWizard, setShowWizard] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeLeaving, setNoticeLeaving] = useState(false);
  const [error, setError] = useState("");
  const [removingId, setRemovingId] = useState("");
  const [publishingId, setPublishingId] = useState("");
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null);
  const [thumbUploadId, setThumbUploadId] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const categoryOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const biz of businesses) {
      if (biz.categoryId) map.set(biz.categoryId, biz.categoryLabel);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [businesses]);

  const eventsByBusiness = useMemo(() => {
    const map = new Map<string, RuxEvent[]>();
    for (const event of vendorEvents) {
      const list = map.get(event.businessId) ?? [];
      list.push(event);
      map.set(event.businessId, list);
    }
    return map;
  }, [vendorEvents]);

  const filteredBusinesses = useMemo(() => {
    return businesses.filter((biz) => {
      if (categoryFilter !== "all" && biz.categoryId !== categoryFilter) return false;
      if (
        statusFilter !== "all" &&
        businessStatusKey(biz, eventsByBusiness.get(biz.id) ?? []) !== statusFilter
      ) {
        return false;
      }
      return true;
    });
  }, [businesses, categoryFilter, statusFilter, eventsByBusiness]);

  const filtersActive = categoryFilter !== "all" || statusFilter !== "all";

  useEffect(() => {
    if (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Could not load businesses.");
    }
  }, [fetchError]);

  useEffect(() => {
    if (!notice) {
      setNoticeLeaving(false);
      return;
    }

    setNoticeLeaving(false);
    const fadeTimer = window.setTimeout(() => setNoticeLeaving(true), 4000);
    const clearTimer = window.setTimeout(() => {
      setNotice("");
      setNoticeLeaving(false);
    }, 4500);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(clearTimer);
    };
  }, [notice]);

  if (!kycVerified) {
    const status = kyc?.status ?? "pending";
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="glass rounded-2xl p-10">
          <p className="text-4xl">🔒</p>
          <h1 className="mt-4 text-xl font-semibold">Get your Ruxstar Card first</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Business onboarding unlocks after your identity is verified.
            {status === "pending_review" && " Your card is under admin review."}
          </p>
          {kyc?.rejectReason && (
            <p className="mt-3 text-sm text-red-200/90">Reason: {kyc.rejectReason}</p>
          )}
          <Link
            href="/business/kyc"
            className="btn-primary mt-6 inline-block rounded-full px-6 py-2.5 text-sm font-semibold"
          >
            {status === "pending_review" ? "View card status" : "Get your Ruxstar Card"}
          </Link>
        </div>
      </div>
    );
  }

  async function onWizardComplete(data: BusinessOnboardResult) {
    setSaving(true);
    setError("");
    try {
      let created = await createBusiness({
        name: data.name,
        typeId: data.typeId,
        phone: data.phone,
        address: data.address,
        addressParts: data.addressParts,
        ...(data.geo ? { geo: data.geo } : {}),
        description: data.description,
        thumbnail: data.thumbnail,
        ...(data.bookingMode ? { bookingMode: data.bookingMode } : {}),
      });
      if (!businessThumbnailUrl(created) && data.thumbnail) {
        created = await uploadBusinessThumbnail(created.id, data.thumbnail);
      }
      await mutateBusinesses([created, ...businesses], { revalidate: false });
      invalidateBusinesses();
      setShowWizard(false);
      if (supportsEvents(created.module)) {
        router.push(`/business/businesses/${created.id}/events/new`);
        return;
      }
      if (supportsSetup(created.module, created.typeId)) {
        router.push(`/business/businesses/${created.id}/setup`);
        return;
      }
      setNotice(`"${created.name}" is onboarded.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save business.");
    } finally {
      setSaving(false);
    }
  }

  async function onUploadThumbnail(biz: Business, file: File) {
    if (!file.type.startsWith("image/")) return;
    setThumbUploadId(biz.id);
    setError("");
    try {
      const image = await compressImageForUpload(file);
      const updated = await uploadBusinessThumbnail(biz.id, image);
      await mutateBusinesses(
        businesses.map((b) => (b.id === updated.id ? updated : b)),
        { revalidate: false },
      );
      invalidateBusinesses();
      setNotice(`Cover photo updated for "${updated.name}".`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload cover photo.");
    } finally {
      setThumbUploadId("");
    }
  }

  async function onPublish(biz: Business) {
    setPublishingId(biz.id);
    setError("");
    try {
      const updated = await publishBusiness(biz.id);
      await mutateBusinesses(
        businesses.map((b) => (b.id === updated.id ? updated : b)),
        { revalidate: false },
      );
      invalidateBusinesses();
      setNotice(`"${updated.name}" is live again.`);
    } catch (err) {
      if (err instanceof ValidationError) {
        setError(`Cannot publish: ${err.issues.map((i) => i.message).join("; ")}`);
      } else {
        setError(err instanceof Error ? err.message : "Could not update visibility.");
      }
    } finally {
      setPublishingId("");
    }
  }

  async function onRemove(id: string) {
    setRemovingId(id);
    setError("");
    try {
      await deleteBusiness(id);
      await mutateBusinesses(
        businesses.filter((b) => b.id !== id),
        { revalidate: false },
      );
      invalidateBusinesses();
      setNotice("Business removed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove business.");
    } finally {
      setRemovingId("");
    }
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col">
      <div className="shrink-0">
        <div className="flex flex-nowrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-zinc-500">Businesses</p>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <h1 className="text-2xl font-semibold sm:text-3xl">
                <span className="text-gradient">My businesses</span>
              </h1>
              {!loading && businesses.length > 0 && (
                <span className="text-sm text-zinc-500">
                  {filtersActive
                    ? `${filteredBusinesses.length} of ${businesses.length}`
                    : `${businesses.length} total`}
                </span>
              )}
            </div>
          </div>

          {!loading && businesses.length > 0 && (
            <div className="flex shrink-0 items-center gap-2">
              <select
                className={`${filterSelect} w-[8.75rem] sm:w-40`}
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                aria-label="Filter by category"
              >
                <option value="all">All categories</option>
                {categoryOptions.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                className={`${filterSelect} w-[7.5rem] sm:w-32`}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                aria-label="Filter by status"
              >
                <option value="all">All status</option>
                <option value="live">Live</option>
                <option value="offline">Offline</option>
                <option value="setup">Needs setup</option>
                <option value="soon">Coming soon</option>
              </select>
              <button type="button" onClick={() => setShowWizard(true)} className={toolbarBtn}>
                + Onboard
              </button>
            </div>
          )}

          {!loading && businesses.length === 0 && (
            <button type="button" onClick={() => setShowWizard(true)} className={toolbarBtn}>
              + Onboard business
            </button>
          )}
        </div>

        {notice && (
          <p
            className={`mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100 transition-opacity duration-500 ${
              noticeLeaving ? "opacity-0" : "opacity-100"
            }`}
          >
            {notice}
          </p>
        )}
        {error && (
          <p className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </p>
        )}
      </div>

      {loading && kycVerified ? (
        <div className="mt-6 grid shrink-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass h-40 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : businesses.length === 0 ? (
        <div className="mt-8 shrink-0">
          <VendorOnboardPrompt onStart={() => setShowWizard(true)} />
        </div>
      ) : (
        <div className="scroll-pane mt-6 min-h-0 flex-1">
          {filteredBusinesses.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 py-16 text-center">
              <p className="text-sm text-zinc-400">No businesses match these filters.</p>
              <button
                type="button"
                onClick={() => {
                  setCategoryFilter("all");
                  setStatusFilter("all");
                }}
                className="mt-3 text-sm text-emerald-400 hover:text-emerald-300"
              >
                Clear filters
              </button>
            </div>
          ) : (
          <div className="grid gap-4 pb-2 sm:grid-cols-2 lg:grid-cols-3">
          {filteredBusinesses.map((biz) => {
            const bizEvents = eventsByBusiness.get(biz.id) ?? [];
            const action = businessAction(biz, bizEvents);
            const badge = STATUS_BADGES[businessStatusKey(biz, bizEvents)];
            const thumbInputId = `thumb-${biz.id}`;
            const hasThumbnail = Boolean(businessThumbnailUrl(biz));
            return (
              <article key={biz.id} className="glass group overflow-hidden rounded-2xl">
                <div className="relative aspect-[16/9] w-full border-b border-white/5 bg-[#121214]">
                  <BusinessThumbnail
                    business={biz}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                    uploading={thumbUploadId === biz.id}
                    onMissingClick={
                      hasThumbnail || thumbUploadId === biz.id
                        ? undefined
                        : () => document.getElementById(thumbInputId)?.click()
                    }
                  />
                  <button
                    type="button"
                    onClick={() => document.getElementById(thumbInputId)?.click()}
                    disabled={thumbUploadId === biz.id}
                    className="absolute bottom-3 left-3 rounded-full border border-white/15 bg-black/55 px-3 py-1 text-xs font-medium text-zinc-100 backdrop-blur-sm transition hover:bg-black/70 disabled:opacity-50"
                  >
                    {thumbUploadId === biz.id ? "Uploading…" : hasThumbnail ? "Edit cover" : "Add cover"}
                  </button>
                  <input
                    id={thumbInputId}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={thumbUploadId === biz.id}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void onUploadThumbnail(biz, file);
                    }}
                  />
                  <div className="absolute right-3 top-3 flex items-center gap-1.5">
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium backdrop-blur-sm ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium backdrop-blur-sm ${MODULE_STYLES[biz.module]}`}
                    >
                      {moduleLabel(biz.module, moduleLabels)}
                    </span>
                  </div>
                </div>

                {action.disabled || !action.href ? (
                  <div className="block p-4">
                    <h3 className="truncate font-medium text-zinc-100">{biz.name}</h3>
                    <p className="mt-0.5 text-sm text-zinc-500">
                      {biz.typeLabel}
                      <span className="text-zinc-600"> · {biz.categoryLabel}</span>
                    </p>
                    {biz.address && (
                      <p className="mt-1 truncate text-xs text-zinc-600">{biz.address}</p>
                    )}
                  </div>
                ) : (
                  <Link href={action.href} className="block p-4">
                    <h3 className="truncate font-medium text-zinc-100 group-hover:text-white">
                      {biz.name}
                    </h3>
                    <p className="mt-0.5 text-sm text-zinc-500">
                      {biz.typeLabel}
                      <span className="text-zinc-600"> · {biz.categoryLabel}</span>
                    </p>
                    {biz.address && (
                      <p className="mt-1 truncate text-xs text-zinc-600">{biz.address}</p>
                    )}
                  </Link>
                )}

                <div className="flex items-center justify-between gap-2 border-t border-white/5 px-4 py-3">
                  {action.disabled || !action.href ? (
                    <span
                      className={`${cardActionBtn} cursor-not-allowed opacity-40`}
                      aria-disabled
                    >
                      {action.label}
                    </span>
                  ) : (
                    <Link href={action.href} className={cardActionBtn}>
                      {action.label}
                      <span className="ml-1">→</span>
                    </Link>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingBusiness(biz)}
                      className={removeBtnClass}
                    >
                      Edit details
                    </button>
                    {biz.setupComplete && supportsCreatorSetup(biz.module) && (
                      <Link href={`/business/businesses/${biz.id}/offers`} className={removeBtnClass}>
                        Offers
                      </Link>
                    )}
                    {/* Only a recovery action: a listing can go offline when an
                        edit breaks its go-live requirements. */}
                    {biz.setupComplete && biz.status !== "live" && (
                      <button
                        type="button"
                        onClick={() => onPublish(biz)}
                        disabled={publishingId === biz.id}
                        className={removeBtnClass}
                      >
                        {publishingId === biz.id ? "Saving…" : "Publish"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onRemove(biz.id)}
                      disabled={removingId === biz.id}
                      className={removeBtnClass}
                    >
                      {removingId === biz.id ? "Removing…" : "Remove"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
          </div>
          )}
        </div>
      )}

      {editingBusiness && (
        <BusinessProfileDialog
          business={editingBusiness}
          onClose={() => setEditingBusiness(null)}
          onSaved={async (updated) => {
            setEditingBusiness(null);
            await mutateBusinesses(
              businesses.map((b) => (b.id === updated.id ? updated : b)),
              { revalidate: false },
            );
            invalidateBusinesses();
            setNotice(`"${updated.name}" updated.`);
          }}
        />
      )}

      {showWizard && (
        <BusinessOnboardWizard
          saving={saving}
          onClose={() => {
            if (!saving) setShowWizard(false);
          }}
          onComplete={onWizardComplete}
        />
      )}
    </div>
  );
}
