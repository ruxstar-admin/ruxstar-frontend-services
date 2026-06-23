"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { CustomerBackLink } from "@/components/customer-shell";
import { openCashfreeCheckout } from "@/lib/cashfree-checkout";
import { invalidateMyEventRegistrations } from "@/lib/swr-hooks";
import { getPublicEvent, registerForEvent } from "@/lib/api";

function formatWhen(iso: string | null) {
  if (!iso) return "Date to be announced";
  return new Date(iso).toLocaleString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

export default function CustomerEventPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = String(params.id);

  const { data: event, isLoading, error } = useSWR(`public/events/${eventId}`, () =>
    getPublicEvent(eventId),
  );

  const isTeam = event?.format === "team";
  const teamSize = event?.teamSize ?? 1;

  const [teamName, setTeamName] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [done, setDone] = useState(false);

  const memberInputs = useMemo(
    () => Array.from({ length: isTeam ? Math.max(1, teamSize) : 0 }, (_, i) => members[i] ?? ""),
    [isTeam, teamSize, members],
  );

  const full = event?.spotsLeft === 0;
  const closed = event?.status !== "published";

  async function handleRegister() {
    if (!event) return;
    setFormError("");
    if (isTeam && !teamName.trim()) {
      setFormError("Please enter a team name.");
      return;
    }
    setSubmitting(true);
    try {
      const participants = isTeam
        ? memberInputs.map((n) => ({ name: n.trim() })).filter((p) => p.name)
        : [];
      const { payment } = await registerForEvent(eventId, {
        teamName: isTeam ? teamName.trim() : undefined,
        participants,
      });
      await invalidateMyEventRegistrations();

      if (payment) {
        await openCashfreeCheckout(payment.paymentSessionId, payment.mode);
        return; // redirects away
      }
      setDone(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not register.");
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="px-5">
        <div className="h-64 animate-pulse rounded-2xl bg-white/5" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="px-5">
        <CustomerBackLink />
        <div className="glass rounded-2xl p-10 text-center">
          <p className="text-3xl">🔍</p>
          <p className="mt-3 text-sm text-zinc-400">This event isn&apos;t available.</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="px-5">
        <div className="glass mx-auto max-w-lg rounded-2xl p-8 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-emerald-500/15 text-2xl">
            ✓
          </div>
          <h1 className="text-xl font-semibold">You&apos;re registered!</h1>
          <p className="mt-2 text-sm text-zinc-400">{event.title}</p>
          <p className="mt-1 text-sm text-zinc-500">{formatWhen(event.startAt)}</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/customer?view=bookings"
              className="btn-primary rounded-full px-6 py-2.5 text-sm font-semibold"
            >
              View my events
            </Link>
            <button
              type="button"
              onClick={() => router.push("/customer")}
              className="rounded-full border border-white/10 px-6 py-2.5 text-sm text-zinc-300 hover:bg-white/5"
            >
              Discover
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5">
      <CustomerBackLink />

      <div className="overflow-hidden rounded-3xl border border-white/8">
        <div className="relative h-48 w-full bg-gradient-to-br from-violet-500/25 via-white/5 to-transparent sm:h-60">
          {event.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.coverUrl} alt={event.title} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-6xl opacity-80">
              {event.kind === "tournament" ? "🏆" : "🎫"}
            </div>
          )}
          <span className="absolute left-4 top-4 rounded-full bg-black/50 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-zinc-100 backdrop-blur">
            {event.kind === "tournament" ? "Tournament" : "Event"}
          </span>
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold sm:text-3xl">{event.title}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {event.tournamentType ? `${event.tournamentType} · ` : ""}
            by {event.businessName}
          </p>

          <div className="mt-5 space-y-2 text-sm text-zinc-300">
            <p className="flex items-center gap-2">
              <span aria-hidden>🗓️</span> {formatWhen(event.startAt)}
            </p>
            {event.venue && (
              <p className="flex items-center gap-2">
                <span aria-hidden>📍</span> {event.venue}
              </p>
            )}
            {event.registrationDeadline && (
              <p className="flex items-center gap-2 text-zinc-500">
                <span aria-hidden>⏳</span> Registration closes {formatWhen(event.registrationDeadline)}
              </p>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {isTeam && (
              <Chip label={`Team of ${teamSize}`} />
            )}
            {!isTeam && event.kind === "tournament" && <Chip label="Individual entry" />}
            {event.skillLevel && <Chip label={event.skillLevel} />}
            {event.ageCategory && <Chip label={event.ageCategory} />}
            {event.genderCategory && <Chip label={event.genderCategory} />}
          </div>

          {event.description && (
            <div className="mt-6">
              <h2 className="text-sm font-medium text-zinc-300">About</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-400">
                {event.description}
              </p>
            </div>
          )}

          {event.rules && (
            <div className="mt-6">
              <h2 className="text-sm font-medium text-zinc-300">Rules & eligibility</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-400">
                {event.rules}
              </p>
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <div className="glass rounded-2xl p-5">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-semibold text-emerald-300">
                {event.entryFee > 0 ? `₹${event.entryFee.toLocaleString("en-IN")}` : "Free entry"}
              </span>
              {event.entryFee > 0 && (
                <span className="text-xs text-zinc-500">per {isTeam ? "team" : "entry"}</span>
              )}
            </div>

            {event.capacity != null && (
              <p className="mt-1 text-xs text-zinc-500">
                {full ? "Sold out" : `${event.spotsLeft} of ${event.capacity} spots left`}
              </p>
            )}

            {closed ? (
              <p className="mt-5 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center text-sm text-zinc-400">
                Registration is closed.
              </p>
            ) : full ? (
              <p className="mt-5 rounded-xl border border-red-400/20 bg-red-400/[0.05] p-3 text-center text-sm text-red-300">
                This event is full.
              </p>
            ) : (
              <div className="mt-5 space-y-3">
                {isTeam && (
                  <>
                    <label className="block">
                      <span className="text-sm text-zinc-400">Team name</span>
                      <input
                        className="field-input mt-1.5 w-full text-sm"
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        placeholder="Your team's name"
                      />
                    </label>
                    <div className="space-y-2">
                      <span className="text-sm text-zinc-400">Players</span>
                      {memberInputs.map((val, i) => (
                        <input
                          key={i}
                          className="field-input w-full text-sm"
                          value={val}
                          onChange={(e) => {
                            const next = [...memberInputs];
                            next[i] = e.target.value;
                            setMembers(next);
                          }}
                          placeholder={`Player ${i + 1}${i === 0 ? " (captain)" : ""}`}
                        />
                      ))}
                    </div>
                  </>
                )}

                {formError && <p className="text-sm text-red-400">{formError}</p>}

                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleRegister}
                  className="btn-primary w-full rounded-full py-3 text-sm font-semibold disabled:opacity-50"
                >
                  {submitting
                    ? "Processing…"
                    : event.entryFee > 0
                      ? `Pay & register · ₹${event.entryFee.toLocaleString("en-IN")}`
                      : "Register for free"}
                </button>
                {event.entryFee > 0 && (
                  <p className="text-center text-[11px] text-zinc-600">
                    Secure payment via Cashfree
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-zinc-300">
      {label}
    </span>
  );
}
