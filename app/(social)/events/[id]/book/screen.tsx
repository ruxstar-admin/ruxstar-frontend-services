"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Button, ButtonLink, Icon, Input } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useMe } from "@/components/social/session";
import { Stepper } from "@/components/events/Stepper";
import { useLoad } from "@/components/vendor/use-load";
import { formError } from "@/lib/api/account";
import { ApiError, newIdempotencyKey } from "@/lib/api/client";
import { bookTickets, getEvent, type EventDetail, type EventQuestion } from "@/lib/api/events";
import { money } from "@/lib/api/shops";
import {
  countOf,
  orderPrice,
  peopleFor,
  personErrors,
  playersFor,
  refundText,
  toHolders,
  whenLine,
  type PersonDraft,
  type Selection,
} from "@/lib/events";
import shop from "@/components/shop/shop.module.css";
import order from "@/components/shop/order.module.css";
import styles from "@/components/events/events.module.css";

const STEPS = ["Tickets", "Who’s coming", "Pay"] as const;
const FEW_LEFT = 20;

function StepBar({ at }: { at: number }) {
  return (
    <ol className={styles.steps} aria-label="Steps">
      {STEPS.map((s, i) => (
        <li key={s} aria-current={i === at ? "step" : undefined} data-done={i < at || undefined}>
          {s}
        </li>
      ))}
    </ol>
  );
}

/** One ticket holder: the name the gate sees, a number for their ticket, and the organiser's questions. */
function PersonCard({
  person,
  heading,
  questions,
  errors,
  onChange,
}: {
  person: PersonDraft;
  heading: string;
  questions: EventQuestion[];
  errors: Record<string, string>;
  onChange: (next: PersonDraft) => void;
}) {
  return (
    <fieldset className={styles.person}>
      <h3>{heading}</h3>
      <Input label="Name" value={person.name} onChange={(e) => onChange({ ...person, name: e.target.value })} maxLength={60} autoComplete="name" error={errors.name} />
      <Input
        label="Mobile number"
        type="tel"
        inputMode="tel"
        value={person.phone}
        onChange={(e) => onChange({ ...person, phone: e.target.value })}
        maxLength={14}
        autoComplete="tel"
        hint="For their ticket. Only the organiser sees it."
        error={errors.phone}
      />
      {questions.map((q) => (
        <Input
          key={q.id}
          label={q.required ? q.label : `${q.label} (optional)`}
          value={person.answers[q.id] ?? ""}
          onChange={(e) => onChange({ ...person, answers: { ...person.answers, [q.id]: e.target.value } })}
          maxLength={200}
          error={errors[q.id]}
        />
      ))}
    </fieldset>
  );
}

function Line({ label, amount, strong }: { label: string; amount: number; strong?: boolean }) {
  return (
    <div className={strong ? `${order.priceRow} ${order.total}` : order.priceRow}>
      <dt>{label}</dt>
      <dd>{amount === 0 ? "Free" : money(amount)}</dd>
    </div>
  );
}

function Booking({ event, waitlistId }: { event: EventDetail; waitlistId?: string }) {
  const router = useRouter();
  const user = useMe();
  const me = user ? { name: user.name, mobile: user.phone } : undefined;
  const offer = waitlistId ? event.myWaits.find((w) => w.id === waitlistId && w.status === "offered") : undefined;
  const team = event.teamSize;
  const tierOrder = event.tiers.map((t) => t.id);

  const [step, setStep] = useState(0);
  const [selection, setSelection] = useState<Selection>(() => (offer ? { [offer.tierId]: team ? 1 : offer.quantity } : {}));
  const [teamTier, setTeamTier] = useState(offer?.tierId ?? event.tiers.find((t) => !t.soldOut)?.id ?? "");
  const [teamName, setTeamName] = useState("");
  const [players, setPlayers] = useState(team?.min ?? 1);
  const [people, setPeople] = useState<PersonDraft[]>([]);
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const attempt = useRef(newIdempotencyKey());

  const picked = team ? { [teamTier]: 1 } : selection;
  const count = team ? players : countOf(selection);
  const price = orderPrice(picked, event.tiers, event.platformFee, !!team);
  const free = price.total === 0;
  const errors = useMemo(() => people.map((p) => personErrors(p, event.questions)), [people, event.questions]);
  const phoneTwice = useMemo(() => {
    const phones = people.map((p) => p.phone.replace(/\D/g, "").slice(-10)).filter((p) => p.length === 10);
    return new Set(phones).size < phones.length;
  }, [people]);

  const setQty = (tierId: string, n: number) => setSelection((s) => ({ ...s, [tierId]: n }));
  const others = (tierId: string) => countOf(selection) - (selection[tierId] ?? 0);

  const go = (next: number) => {
    setStep(next);
    window.scrollTo({ top: 0 });
  };

  const toPeople = () => {
    setPeople((prev) => (team ? playersFor(players, teamTier, prev, me) : peopleFor(selection, tierOrder, prev, me)));
    setShown(false);
    go(1);
  };

  const toPay = () => {
    setShown(true);
    const first = errors.findIndex((e) => Object.keys(e).length);
    if (first >= 0) {
      document.querySelectorAll("fieldset")[first]?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    go(2);
  };

  const place = async () => {
    setBusy(true);
    setFailure(null);
    try {
      const { order: placed, checkoutUrl } = await bookTickets(
        event.id,
        {
          tickets: toHolders(people, event.questions),
          ...(team ? { team: { tierId: teamTier, name: teamName.trim() } } : {}),
          ...(offer ? { waitlistId: offer.id } : {}),
          returnTo: `${window.location.origin}/tickets`,
        },
        attempt.current,
      );
      if (checkoutUrl) window.location.assign(checkoutUrl);
      else router.replace(`/tickets/${placed.id}?fresh=1`);
    } catch (err) {
      setFailure(formError(err).message);
      // A booking that timed out may have been placed; trying again with the same key returns it instead of holding seats twice.
      if (!(err instanceof ApiError && err.code === "NETWORK")) attempt.current = newIdempotencyKey();
      setBusy(false);
    }
  };

  const canNext = team ? !!teamTier && teamName.trim().length >= 2 : count > 0;

  return (
    <div className={order.page}>
      <div className={shop.head}>
        <h1 className={order.title}>{event.title}</h1>
        <p className={order.small}>{whenLine(event.startsAt, event.endsAt)}</p>
      </div>
      <StepBar at={step} />
      {step > 0 && (
        <button type="button" className={styles.textLink} onClick={() => go(step - 1)}>
          ‹ Back a step
        </button>
      )}

      {step === 0 && team && (
        <>
          <p className={order.small}>
            {`Book for your team. You pay once, and each of the ${team.min === team.max ? team.min : `${team.min} to ${team.max}`} players gets their own QR code.`}
          </p>
          {event.tiers.length > 1 && !offer && (
            <div className={styles.chips} role="group" aria-label="Entry type">
              {event.tiers
                .filter((t) => !t.soldOut)
                .map((t) => (
                  <button key={t.id} type="button" className={shop.subChip} aria-pressed={teamTier === t.id} onClick={() => setTeamTier(t.id)}>
                    {`${t.name} · ${t.price === 0 ? "Free" : money(t.price)}`}
                  </button>
                ))}
            </div>
          )}
          <Input label="Team name" value={teamName} onChange={(e) => setTeamName(e.target.value)} maxLength={60} placeholder="e.g. Madhapur Strikers" />
          <ul className={styles.tiers}>
            <li className={styles.tierRow}>
              <span className={styles.tierText}>
                <span className={styles.tierName}>Players</span>
                <span className={styles.seats}>{team.min === team.max ? `Exactly ${team.min}` : `${team.min} to ${team.max}`}</span>
              </span>
              <Stepper value={players} min={team.min} max={team.max} onChange={setPlayers} label="players" />
            </li>
          </ul>
        </>
      )}

      {step === 0 && !team && (
        <>
          <p className={order.small}>
            {offer ? "These are held for you from the waitlist." : `Up to ${event.maxPerOrder} tickets in one booking. Each person gets their own QR code.`}
          </p>
          <ul className={styles.tiers}>
            {event.tiers.map((t) => {
              const held = offer?.tierId === t.id ? offer.quantity : 0;
              const max = offer ? held : Math.min(t.left, event.maxPerOrder - others(t.id));
              const off = offer ? offer.tierId !== t.id : t.soldOut;
              return (
                <li key={t.id} className={styles.tierRow} style={off ? { opacity: 0.5 } : undefined}>
                  <span className={styles.tierText}>
                    <span className={styles.tierName}>{t.name}</span>
                    <span className={order.small}>{t.price === 0 ? "Free" : money(t.price)}</span>
                    {!offer && !t.soldOut && t.left <= FEW_LEFT && <span className={styles.seats} data-low>{`Only ${t.left} left`}</span>}
                    {!offer && t.soldOut && <span className={styles.seats} data-out>Sold out</span>}
                  </span>
                  {!off && (
                    <Stepper value={selection[t.id] ?? 0} min={offer ? held : 0} max={Math.max(0, max)} onChange={(n) => setQty(t.id, n)} label={`${t.name} tickets`} />
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {step === 1 && (
        <>
          <p className={order.small}>Add each person’s name as on an ID. The gate checks it against the ticket.</p>
          {people.map((p, i) => (
            <PersonCard
              key={p.key}
              person={p}
              heading={team ? `Player ${i + 1}${i === 0 ? " · captain" : ""}` : `Ticket ${i + 1} · ${event.tiers.find((t) => t.id === p.tierId)?.name ?? ""}`}
              questions={event.questions}
              errors={shown ? errors[i]! : {}}
              onChange={(next) => setPeople((all) => all.map((x) => (x.key === next.key ? next : x)))}
            />
          ))}
          {phoneTwice && <p className={order.faint}>The same number is on more than one ticket. That’s fine if one person keeps them all.</p>}
        </>
      )}

      {step === 2 && (
        <>
          <div className={order.panel}>
            <dl className={order.prices}>
              {team ? (
                <Line label={`${teamName.trim()} · ${players} players`} amount={price.items} />
              ) : (
                event.tiers.filter((t) => selection[t.id]).map((t) => <Line key={t.id} label={`${selection[t.id]} × ${t.name}`} amount={t.price * selection[t.id]!} />)
              )}
              {price.fee > 0 && <Line label="Platform fee" amount={price.fee} />}
              <Line label="Total" amount={price.total} strong />
            </dl>
          </div>
          <section className={order.section}>
            <h2 className={order.overline}>{team ? "Players" : "Tickets for"}</h2>
            <ul className={styles.qList}>
              {people.map((p) => (
                <li key={p.key}>{p.name.trim()}</li>
              ))}
            </ul>
          </section>
          <div className={styles.factRow}>
            <Icon name="shield" size={18} />
            <span>{refundText(event.refunds, free)}</span>
          </div>
          {!free && <p className={order.faint}>You’ll pay on Cashfree’s secure page. Your tickets are held for 20 minutes while you pay.</p>}
        </>
      )}

      {failure && (
        <p className={order.error} role="alert">
          {failure}
        </p>
      )}

      <div className={shop.orderBar}>
        <span className={shop.orderText}>
          <strong>{count ? (free ? "Free" : money(price.total)) : "No tickets yet"}</strong>
          <span className={order.faint}>{count ? `${count} ${team ? (count === 1 ? "player" : "players") : count === 1 ? "ticket" : "tickets"}` : STEPS[step]}</span>
        </span>
        {step === 0 ? (
          <Button disabled={!canNext} onClick={toPeople}>
            {count && !team ? `Continue · ${count} ${count === 1 ? "ticket" : "tickets"}` : team ? "Continue" : "Choose tickets"}
          </Button>
        ) : step === 1 ? (
          <Button onClick={toPay}>Continue</Button>
        ) : (
          <Button loading={busy} onClick={() => void place()}>
            {free ? "Get my free tickets" : `Pay ${money(price.total)}`}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Buying tickets: how many of each, a card per person, then pay. Free tickets are confirmed straight away. Same as the app. */
export function BookScreen({ id, waitlistId }: { id: string; waitlistId?: string }) {
  const { data, error, reload } = useLoad(() => getEvent(id), id);
  if (data) {
    if (data.status !== "live" || (!data.canBuy && !waitlistId)) {
      return (
        <Empty title={data.status === "live" ? (data.whyNot ?? "Tickets aren’t on sale") : "Tickets aren’t on sale"}>
          <p>{data.status === "cancelled" ? "This event was cancelled." : data.status === "ended" ? "This event is over." : "Check the event page for what’s left."}</p>
          <ButtonLink href={`/events/${id}`} variant="secondary">
            Back to the event
          </ButtonLink>
        </Empty>
      );
    }
    return <Booking event={data} waitlistId={waitlistId} />;
  }
  if (error) {
    return (
      <Empty title="Could not load this event">
        <p>{formError(error).message}</p>
        <Button variant="secondary" icon={<Icon name="refresh" size={16} />} onClick={reload}>
          Try again
        </Button>
      </Empty>
    );
  }
  return (
    <div className={order.page} aria-busy>
      <div className={shop.skeletonCard} />
    </div>
  );
}
