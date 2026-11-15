"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { Button, Icon, Input, Switch } from "@/components/ui";
import { Back, Failed, Loading, TextArea } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { formError } from "@/lib/api/account";
import { keepIdempotencyKey, newIdempotencyKey } from "@/lib/api/client";
import { createEvent, eventRules, getVendorEvent, updateEvent, type EventKind, type EventRules, type VendorEvent } from "@/lib/api/events";
import { money } from "@/lib/api/shops";
import {
  DRAFT_STEPS,
  draftErrors,
  draftOf,
  emptyDraft,
  HALF_HOURS,
  istToday,
  KIND_LABEL,
  KINDS,
  toEventInput,
  type EventDraft,
  type QuestionDraft,
  type TierDraft,
} from "@/lib/events";
import vendor from "@/components/vendor/vendor.module.css";
import styles from "./events.module.css";

/** How far ahead an event can be put on sale from the form. */
const DAYS_AHEAD = 365;

function TimeSelect({ label, value, onChange, error }: { label: string; value: string; onChange: (v: string) => void; error?: string }) {
  const id = useId();
  return (
    <div className={vendor.field}>
      <label htmlFor={id} className={vendor.label}>
        {label}
      </label>
      <select
        id={id}
        className={vendor.select}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.value)}
      >
        {HALF_HOURS.map((h) => (
          <option key={h.value} value={h.value}>
            {h.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${id}-error`} className={vendor.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function StepBar({ at }: { at: number }) {
  return (
    <ol className={styles.steps} aria-label="Steps">
      {DRAFT_STEPS.map((s, i) => (
        <li key={s.key} aria-current={i === at ? "step" : undefined} data-done={i < at || undefined}>
          {s.label}
        </li>
      ))}
    </ol>
  );
}

function Form({ rules, event, businessId }: { rules: EventRules; event?: VendorEvent; businessId?: string }) {
  const router = useRouter();
  const editing = !!event;
  const [draft, setDraft] = useState<EventDraft>(() => (event ? draftOf(event) : emptyDraft()));
  const [step, setStep] = useState(0);
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const attempt = useRef(newIdempotencyKey());
  const [openedAt] = useState(Date.now);
  const today = istToday(openedAt);
  const lastDay = istToday(openedAt + DAYS_AHEAD * 24 * 60 * 60_000);

  const stepKey = DRAFT_STEPS[step]!.key;
  const errors = draftErrors(draft, stepKey, rules, openedAt, event?.startsAt);
  const err = (field: string) => (shown ? errors[field] : undefined);
  const sold = draft.tiers.some((t) => t.taken > 0);
  const last = step === DRAFT_STEPS.length - 1;
  const back = event ? `/vendor/events/${event.id}` : `/vendor/businesses/${businessId}/events`;

  const set = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setTier = (i: number, patch: Partial<TierDraft>) => setDraft((d) => ({ ...d, tiers: d.tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)) }));
  const setQuestion = (i: number, patch: Partial<QuestionDraft>) =>
    setDraft((d) => ({ ...d, questions: d.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) }));
  const setKind = (kind: EventKind) => setDraft((d) => ({ ...d, kind, team: kind === "sports" ? d.team : false }));
  const setStart = (startDay: string) => setDraft((d) => ({ ...d, startDay, endDay: !d.endDay || d.endDay < startDay ? startDay : d.endDay }));

  const save = async () => {
    setBusy(true);
    setFailure(null);
    try {
      const body = toEventInput(draft);
      if (event) {
        await updateEvent(event.id, body);
        router.push(`/vendor/events/${event.id}`);
      } else {
        const created = await createEvent(businessId!, body, attempt.current);
        router.replace(`/vendor/events/${created.id}?fresh=1`);
      }
    } catch (e) {
      setFailure(formError(e).message);
      if (!keepIdempotencyKey(e)) attempt.current = newIdempotencyKey();
      setBusy(false);
    }
  };

  const go = (next: number) => {
    setStep(next);
    window.scrollTo({ top: 0 });
  };

  const next = () => {
    setShown(true);
    if (Object.keys(errors).length) return;
    setShown(false);
    if (last) void save();
    else go(step + 1);
  };

  return (
    <div className={vendor.page}>
      <Back href={back}>{editing ? "Event" : "Events"}</Back>
      <h1 className={vendor.title}>{editing ? "Edit event" : "New event"}</h1>
      <StepBar at={step} />
      {step > 0 && (
        <button type="button" className={vendor.link} onClick={() => go(step - 1)}>
          ‹ Back a step
        </button>
      )}

      <form
        className={vendor.form}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          next();
        }}
      >
        {stepKey === "basics" && (
          <>
            <div className={vendor.field}>
              <span className={vendor.label} id="kind-label">
                What kind of event?
              </span>
              <div className={vendor.chips} role="group" aria-labelledby="kind-label">
                {KINDS.map((k) => (
                  <button key={k} type="button" className={vendor.chip} aria-pressed={draft.kind === k} onClick={() => setKind(k)}>
                    {KIND_LABEL[k]}
                  </button>
                ))}
              </div>
            </div>
            <Input label="Event name" value={draft.title} onChange={(e) => set("title", e.target.value)} maxLength={100} placeholder="e.g. Sunburn Nights" error={err("title")} />
            <TextArea
              label="About it (optional)"
              value={draft.description}
              onChange={(v) => set("description", v)}
              max={2000}
              placeholder="Who’s performing, what to bring, age limits, parking…"
            />
          </>
        )}

        {stepKey === "when" && (
          <>
            <div className={vendor.pair} data-even>
              <Input
                label="Starts on"
                type="date"
                min={today}
                max={lastDay}
                value={draft.startDay}
                onChange={(e) => setStart(e.target.value)}
                error={err("startDay")}
              />
              <TimeSelect label="At" value={draft.startTime} onChange={(v) => set("startTime", v)} />
            </div>
            <div className={vendor.pair} data-even>
              <Input
                label="Ends on"
                type="date"
                min={draft.startDay || today}
                max={lastDay}
                value={draft.endDay}
                onChange={(e) => set("endDay", e.target.value)}
                error={err("endDay")}
              />
              <TimeSelect label="At" value={draft.endTime} onChange={(v) => set("endTime", v)} error={err("endTime")} />
            </div>
            <p className={vendor.faint}>Times are India time. Tickets stop selling when it starts.</p>
            <div className={vendor.switches}>
              <Switch checked={draft.online} onChange={(v) => set("online", v)} description="People join with a link instead of coming to a venue">
                It’s online
              </Switch>
            </div>
            {draft.online ? (
              <Input
                label="Meeting link"
                type="url"
                inputMode="url"
                value={draft.link}
                onChange={(e) => set("link", e.target.value)}
                autoCapitalize="none"
                spellCheck={false}
                hint="Only people with a ticket see it."
                error={err("link")}
              />
            ) : (
              <>
                <Input label="Venue" value={draft.venueName} onChange={(e) => set("venueName", e.target.value)} maxLength={100} placeholder="e.g. Shilpakala Vedika" error={err("venueName")} />
                <Input label="Address" value={draft.address} onChange={(e) => set("address", e.target.value)} maxLength={200} placeholder="Street, area" error={err("address")} />
                <Input label="City" value={draft.city} onChange={(e) => set("city", e.target.value)} maxLength={60} autoComplete="address-level2" error={err("city")} />
              </>
            )}
          </>
        )}

        {stepKey === "tickets" && (
          <>
            {draft.kind === "sports" && (
              <div className={vendor.switches}>
                <Switch
                  checked={draft.team}
                  disabled={sold}
                  onChange={(v) => set("team", v)}
                  description={sold ? "Can’t change once tickets are sold" : "The captain books and pays once; every player gets a QR code"}
                >
                  Teams enter together
                </Switch>
              </div>
            )}
            {draft.team && (
              <div className={vendor.pair} data-even>
                <Input label="Fewest players" inputMode="numeric" value={draft.teamMin} onChange={(e) => set("teamMin", e.target.value)} maxLength={2} error={err("teamMin")} />
                <Input label="Most players" inputMode="numeric" value={draft.teamMax} onChange={(e) => set("teamMax", e.target.value)} maxLength={2} error={err("teamMax")} />
              </div>
            )}

            {draft.tiers.map((t, i) => (
              <fieldset key={t.id ?? `new${i}`} className={styles.person}>
                <div className={vendor.spread}>
                  <h3>{`Ticket type ${i + 1}`}</h3>
                  {draft.tiers.length > 1 && t.taken === 0 && (
                    <button
                      type="button"
                      className={vendor.iconButton}
                      aria-label={`Remove ticket type ${i + 1}`}
                      onClick={() => setDraft((d) => ({ ...d, tiers: d.tiers.filter((_, j) => j !== i) }))}
                    >
                      <Icon name="trash" size={18} />
                    </button>
                  )}
                </div>
                <Input label="Name" value={t.name} onChange={(e) => setTier(i, { name: e.target.value })} maxLength={40} placeholder="General, VIP, Early bird" error={err(`tier${i}.name`)} />
                <div className={vendor.pair} data-even>
                  <Input
                    label={draft.team ? "Price per team (₹)" : "Price (₹)"}
                    inputMode="decimal"
                    value={t.price}
                    onChange={(e) => setTier(i, { price: e.target.value })}
                    placeholder="0 for free"
                    error={err(`tier${i}.price`)}
                  />
                  <Input
                    label={draft.team ? "Teams" : "Tickets"}
                    inputMode="numeric"
                    value={t.capacity}
                    onChange={(e) => setTier(i, { capacity: e.target.value })}
                    maxLength={6}
                    hint={t.taken ? `${t.taken} booked` : undefined}
                    error={err(`tier${i}.capacity`)}
                  />
                </div>
              </fieldset>
            ))}
            {errors.tiers && shown && (
              <p className={vendor.error} role="alert">
                {errors.tiers}
              </p>
            )}
            {draft.tiers.length < rules.maxTicketTypes && (
              <div>
                <Button
                  variant="secondary"
                  icon={<Icon name="plus" size={16} />}
                  onClick={() => setDraft((d) => ({ ...d, tiers: [...d.tiers, { name: "", price: "", capacity: "", taken: 0 }] }))}
                >
                  Add a ticket type
                </Button>
              </div>
            )}

            <div className={vendor.field}>
              <span className={vendor.label} id="refund-label">
                Refunds
              </span>
              <div className={vendor.chips} role="group" aria-labelledby="refund-label">
                <button type="button" className={vendor.chip} aria-pressed={draft.refunds === "standard"} onClick={() => set("refunds", "standard")}>
                  Refunds allowed
                </button>
                <button type="button" className={vendor.chip} aria-pressed={draft.refunds === "none"} onClick={() => set("refunds", "none")}>
                  No refunds
                </button>
              </div>
              <p className={vendor.faint}>
                {draft.refunds === "standard"
                  ? `People can cancel for a full refund until ${rules.refundHours} hours before it starts.`
                  : "People can’t cancel. If you cancel the event, everyone still gets a full refund."}
                {rules.platformFee ? ` Customers pay a ${money(rules.platformFee)} platform fee on paid tickets.` : ""}
              </p>
            </div>
          </>
        )}

        {stepKey === "extras" && (
          <>
            <p className={vendor.intro}>Every ticket already asks for the person’s name and mobile. Add anything else you need from each person.</p>
            {draft.questions.map((q, i) => (
              <fieldset key={q.id ?? `q${i}`} className={styles.person}>
                <div className={vendor.spread}>
                  <h3>{`Question ${i + 1}`}</h3>
                  <button
                    type="button"
                    className={vendor.iconButton}
                    aria-label={`Remove question ${i + 1}`}
                    onClick={() => setDraft((d) => ({ ...d, questions: d.questions.filter((_, j) => j !== i) }))}
                  >
                    <Icon name="trash" size={18} />
                  </button>
                </div>
                <Input
                  label={`Question ${i + 1}`}
                  value={q.label}
                  onChange={(e) => setQuestion(i, { label: e.target.value })}
                  maxLength={80}
                  placeholder="e.g. T-shirt size"
                  error={err(`question${i}`)}
                />
                <div className={vendor.switches}>
                  <Switch checked={q.required} onChange={(v) => setQuestion(i, { required: v })}>
                    Must answer
                  </Switch>
                </div>
              </fieldset>
            ))}
            {draft.questions.length < rules.maxQuestions ? (
              <div>
                <Button
                  variant="secondary"
                  icon={<Icon name="plus" size={16} />}
                  onClick={() => setDraft((d) => ({ ...d, questions: [...d.questions, { label: "", required: true }] }))}
                >
                  {draft.questions.length ? "Add another question" : "Add a question"}
                </Button>
              </div>
            ) : (
              <p className={vendor.faint}>{rules.maxQuestions ? `Up to ${rules.maxQuestions} questions.` : "Extra questions are turned off on Ruxstar for now."}</p>
            )}
            {!editing && <p className={vendor.faint}>It’s saved as a draft. Add a poster and publish it from the next screen.</p>}
          </>
        )}

        {failure && (
          <p className={vendor.error} role="alert">
            {failure}
          </p>
        )}
        <div className={vendor.actions}>
          <Button type="submit" size="lg" loading={busy}>
            {last ? (editing ? "Save changes" : "Save as draft") : "Continue"}
          </Button>
        </div>
      </form>
    </div>
  );
}

/** Making an event for `businessId` or changing `eventId`, a step at a time. A new event is saved as a draft. Same as the app. */
export function EventForm({ businessId, eventId }: { businessId?: string; eventId?: string }) {
  const rules = useLoad(() => eventRules(), "rules");
  const event = useLoad(() => (eventId ? getVendorEvent(eventId) : Promise.resolve(null)), eventId ?? "new");
  const failed = rules.error ?? event.error;
  if (rules.data && (!eventId || event.data)) return <Form rules={rules.data} event={event.data ?? undefined} businessId={businessId} />;
  if (failed)
    return (
      <Failed
        error={failed}
        onRetry={() => {
          rules.reload();
          event.reload();
        }}
      />
    );
  return <Loading rows={4} />;
}
