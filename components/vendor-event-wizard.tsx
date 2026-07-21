"use client";

import { useMemo, useState } from "react";
import {
  createVendorEvent,
  updateVendorEvent,
  type EventFormat,
  type EventInput,
  type EventKind,
  type RuxEvent,
} from "@/lib/api";

const field = "field-input mt-1.5 w-full text-sm";
const label = "block text-sm text-zinc-400";
const hint = "mt-1 text-xs text-zinc-600";

type StepId = "basics" | "participation" | "schedule" | "entry" | "review";

function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function VendorEventWizard({
  mode,
  businessId,
  businessName,
  eventKind,
  businessTypeLabel,
  initial,
  onDone,
  onCancel,
}: {
  mode: "create" | "edit";
  businessId: string;
  businessName?: string;
  /** Locked from business type at onboarding — not asked again in the wizard. */
  eventKind: EventKind;
  businessTypeLabel?: string;
  initial?: RuxEvent;
  onDone: (event: RuxEvent) => void;
  onCancel: () => void;
}) {
  const kind = initial?.kind ?? eventKind;
  const [tournamentType, setTournamentType] = useState(
    initial?.tournamentType ?? (mode === "create" ? businessTypeLabel ?? "" : ""),
  );
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [format, setFormat] = useState<EventFormat>(initial?.format ?? "individual");
  const [teamSize, setTeamSize] = useState(initial?.teamSize ? String(initial.teamSize) : "");
  const [minCapacity, setMinCapacity] = useState(
    initial?.minCapacity ? String(initial.minCapacity) : "",
  );
  const [capacity, setCapacity] = useState(initial?.capacity ? String(initial.capacity) : "");
  const [skillLevel, setSkillLevel] = useState(initial?.skillLevel ?? "");
  const [ageCategory, setAgeCategory] = useState(initial?.ageCategory ?? "");
  const [genderCategory, setGenderCategory] = useState(initial?.genderCategory ?? "");
  const [startAt, setStartAt] = useState(toLocalInput(initial?.startAt));
  const [endAt, setEndAt] = useState(toLocalInput(initial?.endAt));
  const [deadline, setDeadline] = useState(toLocalInput(initial?.registrationDeadline));
  const [venue, setVenue] = useState(initial?.venue ?? "");
  const [entryFee, setEntryFee] = useState(initial?.entryFee ? String(initial.entryFee) : "");
  const [rules, setRules] = useState(initial?.rules ?? "");

  const [stepIndex, setStepIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isTournament = kind === "tournament";
  const isTeam = isTournament && format === "team";

  const steps: { id: StepId; label: string; title: string; intro: string }[] = useMemo(
    () => [
      {
        id: "basics",
        label: "Basics",
        title: isTournament ? "Tournament details" : "Event details",
        intro: isTournament
          ? "Name your tournament and add a short description."
          : "Name your event and add a short description.",
      },
      {
        id: "participation",
        label: "Participation",
        title: isTournament ? "Who can join" : "Capacity",
        intro: isTournament
          ? "Set how people enter and how many you'll allow."
          : "How many attendees can register?",
      },
      { id: "schedule", label: "Schedule", title: "When & where", intro: "Set the date, time and location." },
      { id: "entry", label: "Entry fee", title: "Entry fee", intro: "Charge an entry fee, or keep it free." },
      { id: "review", label: "Review", title: "Rules & review", intro: "Add rules, then save as a draft." },
    ],
    [isTournament],
  );

  const step = steps[stepIndex];

  function validateStep(): string {
    if (step.id === "basics" && !title.trim()) return "Please add a title.";
    if (step.id === "participation" && isTeam && (!teamSize || Number(teamSize) < 1)) {
      return "Team tournaments need a team size.";
    }
    if (
      step.id === "participation" &&
      minCapacity &&
      capacity &&
      Number(minCapacity) > Number(capacity)
    ) {
      return "Minimum can't be higher than the maximum capacity.";
    }
    if (step.id === "schedule" && !startAt) return "Please set a start date and time.";
    return "";
  }

  function goNext() {
    const v = validateStep();
    if (v) {
      setError(v);
      return;
    }
    setError("");
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  }

  function goBack() {
    setError("");
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  function buildInput(): EventInput {
    return {
      kind,
      title: title.trim(),
      description: description.trim(),
      tournamentType: tournamentType.trim(),
      format: isTournament ? format : "individual",
      teamSize: isTeam && teamSize ? Number(teamSize) : null,
      minCapacity: minCapacity ? Number(minCapacity) : null,
      capacity: capacity ? Number(capacity) : null,
      entryFee: entryFee ? Number(entryFee) : 0,
      venue: venue.trim(),
      skillLevel: skillLevel.trim(),
      ageCategory: ageCategory.trim(),
      genderCategory: genderCategory.trim(),
      rules: rules.trim(),
      startAt: fromLocalInput(startAt) ?? undefined,
      endAt: fromLocalInput(endAt),
      registrationDeadline: fromLocalInput(deadline),
    };
  }

  async function onFinish() {
    setBusy(true);
    setError("");
    try {
      const input = buildInput();
      const event =
        mode === "create"
          ? await createVendorEvent({ ...input, businessId })
          : await updateVendorEvent(initial!.id, input);
      onDone(event);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save event.");
      setBusy(false);
    }
  }

  return (
    <div className="glass flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-2xl">
      <div className="shrink-0 border-b border-white/8 bg-[#0c0c0e] px-5 py-3.5 sm:px-6">
        <p className="text-xs font-medium text-emerald-400">
          Step {stepIndex + 1} of {steps.length} · {step.label}
        </p>
        <h2 className="mt-1 text-lg font-semibold text-white">{step.title}</h2>
        <p className="mt-1 text-sm text-zinc-400">{step.intro}</p>
        {businessName && <p className="mt-1 truncate text-xs text-zinc-600">{businessName}</p>}
        <p className="mt-1 text-xs text-emerald-400/90">
          {isTournament ? "🏆 Tournament" : "🎫 Event"}
          {businessTypeLabel ? ` · ${businessTypeLabel}` : ""}
        </p>
      </div>

      <div className="min-h-[14rem] flex-1 overflow-y-auto px-5 py-5 sm:px-6">
        {error && (
          <p className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-100">
            {error}
          </p>
        )}

        {step.id === "basics" && (
          <div className="space-y-5">
            {isTournament && (
              <label className="block">
                <span className={label}>Sport / game type</span>
                <input
                  className={field}
                  value={tournamentType}
                  onChange={(e) => setTournamentType(e.target.value)}
                  placeholder="Cricket, Football, Esports, Chess…"
                />
                <span className={hint}>Optional — e.g. which sport this tournament is for.</span>
              </label>
            )}
            <label className="block">
              <span className={label}>Title</span>
              <input
                className={field}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={isTournament ? "e.g. Summer Cricket Cup 2026" : "e.g. Live Music Night"}
              />
            </label>
            <label className="block">
              <span className={label}>Description</span>
              <textarea
                className={`${field} min-h-[120px]`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's this about? What should participants expect?"
              />
            </label>
          </div>
        )}

        {step.id === "participation" && (
          <div className="space-y-5">
            {isTournament && (
              <div className="flex gap-2">
                {(["individual", "team"] as EventFormat[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFormat(f)}
                    className={`flex-1 rounded-xl border px-4 py-4 text-sm transition ${
                      format === f
                        ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                        : "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/20"
                    }`}
                  >
                    <span className="block text-2xl">{f === "individual" ? "👤" : "👥"}</span>
                    <span className="mt-1 block capitalize">{f}</span>
                  </button>
                ))}
              </div>
            )}

            {isTeam && (
              <label className="mb-4 block">
                <span className={label}>Players per team</span>
                <input
                  type="number"
                  min={1}
                  className={field}
                  value={teamSize}
                  onChange={(e) => setTeamSize(e.target.value)}
                  placeholder="e.g. 11"
                />
              </label>
            )}

            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className={label}>
                  Minimum to run
                  <span className="ml-1 text-zinc-600">(optional)</span>
                </span>
                <input
                  type="number"
                  min={1}
                  className={field}
                  value={minCapacity}
                  onChange={(e) => setMinCapacity(e.target.value)}
                  placeholder={isTeam ? "e.g. 4 teams" : "e.g. 90"}
                />
              </label>
              <label className="block">
                <span className={label}>
                  {isTournament ? (isTeam ? "Max teams" : "Max participants") : "Max attendees"}
                </span>
                <input
                  type="number"
                  min={1}
                  className={field}
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  placeholder="Leave empty for unlimited"
                />
              </label>
            </div>
            <p className="mt-1.5 text-xs text-zinc-500">
              Minimum is how many you need for the event to run. Maximum is the hard cap on
              registrations.
            </p>

            {isTournament && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className={label}>Skill level</span>
                  <input
                    className={field}
                    value={skillLevel}
                    onChange={(e) => setSkillLevel(e.target.value)}
                    placeholder="Open / Beginner / Pro"
                  />
                </label>
                <label className="block">
                  <span className={label}>Age category</span>
                  <input
                    className={field}
                    value={ageCategory}
                    onChange={(e) => setAgeCategory(e.target.value)}
                    placeholder="U-18 / Open / 30+"
                  />
                </label>
                <label className="block">
                  <span className={label}>Gender category</span>
                  <input
                    className={field}
                    value={genderCategory}
                    onChange={(e) => setGenderCategory(e.target.value)}
                    placeholder="Open / Men / Women / Mixed"
                  />
                </label>
              </div>
            )}
          </div>
        )}

        {step.id === "schedule" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={label}>Starts</span>
              <input
                type="datetime-local"
                className={field}
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
            </label>
            <label className="block">
              <span className={label}>Ends (optional)</span>
              <input
                type="datetime-local"
                className={field}
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
              />
            </label>
            <label className="block">
              <span className={label}>Registration closes (optional)</span>
              <input
                type="datetime-local"
                className={field}
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </label>
            <label className="block">
              <span className={label}>Venue</span>
              <input
                className={field}
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="Address or location"
              />
            </label>
          </div>
        )}

        {step.id === "entry" && (
          <label className="block max-w-xs">
            <span className={label}>Fee per {isTeam ? "team" : "entry"} (₹)</span>
            <input
              type="number"
              min={0}
              className={field}
              value={entryFee}
              onChange={(e) => setEntryFee(e.target.value)}
              placeholder="0 = free entry"
            />
            <span className={hint}>Paid entries are collected securely via Cashfree.</span>
          </label>
        )}

        {step.id === "review" && (
          <div className="space-y-5">
            <label className="block">
              <span className={label}>Rules & eligibility (optional)</span>
              <textarea
                className={`${field} min-h-[110px]`}
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                placeholder="Eligibility, format, what to bring, code of conduct…"
              />
            </label>

            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 text-sm">
              <ReviewRow label="Type" value={`${isTournament ? "Tournament" : "Event"}${tournamentType ? ` · ${tournamentType}` : ""}`} />
              <ReviewRow label="Title" value={title || "—"} />
              {isTournament && (
                <ReviewRow label="Format" value={isTeam ? `Team of ${teamSize || "?"}` : "Individual"} />
              )}
              <ReviewRow
                label="Capacity"
                value={`${minCapacity ? `min ${minCapacity} · ` : ""}${capacity ? `max ${capacity}` : "Unlimited"}`}
              />
              <ReviewRow label="When" value={startAt ? new Date(startAt).toLocaleString("en-IN") : "—"} />
              {venue && <ReviewRow label="Venue" value={venue} />}
              <ReviewRow label="Entry fee" value={entryFee && Number(entryFee) > 0 ? `₹${Number(entryFee).toLocaleString("en-IN")}` : "Free"} />
            </div>
            <p className="text-xs text-zinc-500">
              Saved as a draft — you can publish it from the next screen when you&apos;re ready.
            </p>
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
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-full border border-white/10 px-5 py-2.5 text-sm text-zinc-300 hover:bg-white/5 disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        <div className="flex-1" />
        <button
          type="button"
          disabled={busy}
          onClick={step.id === "review" ? onFinish : goNext}
          className="btn-primary rounded-full px-6 py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          {busy ? "Saving…" : step.id === "review" ? (mode === "create" ? "Create event" : "Save changes") : "Continue"}
        </button>
      </div>
    </div>
  );
}

function ReviewRow({ label: l, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 border-b border-white/5 py-1.5 last:border-0">
      <span className="w-24 shrink-0 text-zinc-500">{l}</span>
      <span className="text-zinc-200">{value}</span>
    </div>
  );
}
