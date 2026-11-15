"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { Button, Icon, Input, Segmented } from "@/components/ui";
import { Back, Failed, Loading } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { formError } from "@/lib/api/account";
import { ApiError, newIdempotencyKey } from "@/lib/api/client";
import { addBatch, coachingRules, getVendorCourse, updateBatch, type BatchInput, type CoachingRules, type Slot, type VendorBatch, type VendorCourse } from "@/lib/api/coaching";
import { money } from "@/lib/api/shops";
import { getTeam, type TeamMember } from "@/lib/api/team";
import { clockText, DAY_LONG, lengthText, minutesOf, planPreview, scheduleText, slotClash, startOf } from "@/lib/coaching";
import { dayLabel, istToday, paiseOf } from "@/lib/events";
import { WeekGrid } from "./WeekGrid";
import vendor from "@/components/vendor/vendor.module.css";
import styles from "./coaching.module.css";

/** The API's most for one batch's fee: ₹2,00,000. */
const MAX_FEE = 2_00_000_00;
const MAX_SLOTS = 14;
const STARTS = Array.from({ length: (23 - 5) * 4 + 1 }, (_, i) => startOf(5 * 60 + i * 15));
const LENGTHS = Array.from({ length: 16 }, (_, i) => (i + 1) * 15);
const ENDS = [
  { value: "classes", label: "Number of classes" },
  { value: "date", label: "End date" },
] as const;

interface Draft {
  name: string;
  fee: string;
  capacity: string;
  minStudents: string;
  slots: Slot[];
  startDate: string;
  ends: "classes" | "date";
  classes: string;
  endDate: string;
  onlineLink: string;
  coachIds: string[];
}

const rupees = (paise: number) => (paise % 100 ? (paise / 100).toFixed(2) : String(paise / 100));
const whole = (text: string) => (/^\d+$/.test(text.trim()) ? Number(text.trim()) : null);
const weekOrder = (a: Slot, b: Slot) => ((a.day + 6) % 7) - ((b.day + 6) % 7) || a.start.localeCompare(b.start);

function draftOf(batch?: VendorBatch): Draft {
  return {
    name: batch?.name ?? "",
    fee: batch ? rupees(batch.fee) : "",
    capacity: batch ? String(batch.capacity) : "20",
    minStudents: batch?.minStudents ? String(batch.minStudents) : "",
    slots: batch?.slots ?? [],
    startDate: batch?.startDate ?? "",
    ends: "classes",
    classes: batch ? String(batch.classes) : "",
    endDate: "",
    onlineLink: batch?.onlineLink ?? "",
    coachIds: batch?.coachIds ?? [],
  };
}

function errorsOf(d: Draft, rules: CoachingRules, online: boolean, locked: boolean, taken: number, today: string): Record<string, string> {
  const e: Record<string, string> = {};
  if (d.name.trim().length < 2) e.name = "For example Weekday evenings";
  const fee = paiseOf(d.fee);
  if (fee === null) e.fee = "The fee for the whole batch, like 4000, or 0 for free";
  else if (fee > MAX_FEE) e.fee = `Up to ${money(MAX_FEE)}`;
  const capacity = whole(d.capacity);
  if (!capacity || capacity > rules.maxBatchSize) e.capacity = `From 1 to ${rules.maxBatchSize}`;
  else if (capacity < taken) e.capacity = `${taken} seats are taken, so at least ${taken}`;
  if (d.minStudents.trim()) {
    const min = whole(d.minStudents);
    if (!min || min < 2) e.minStudents = "At least 2, or leave it empty";
    else if (capacity && min > capacity) e.minStudents = "Can’t be more than the seats";
  }
  if (online && !/^https:\/\/\S+$/.test(d.onlineLink.trim())) e.onlineLink = "A meeting link starting with https://";
  if (!locked) {
    if (!d.slots.length) e.slots = "Tap the grid to add the class times";
    else if (d.slots.length > MAX_SLOTS) e.slots = `Up to ${MAX_SLOTS} classes a week`;
    else {
      const clash = slotClash(d.slots);
      if (clash !== null) e.slots = `${DAY_LONG[d.slots[clash]!.day]} has two classes at the same time`;
    }
    if (!d.startDate) e.startDate = "The day classes begin";
    else if (d.startDate < today) e.startDate = "Today or later";
    if (d.ends === "classes") {
      const n = whole(d.classes);
      if (!n || n > rules.maxClasses) e.classes = `From 1 to ${rules.maxClasses}`;
    } else if (!d.endDate || (d.startDate && d.endDate < d.startDate)) e.endDate = "On or after the start date";
  }
  return e;
}

function inputOf(d: Draft, online: boolean): BatchInput {
  return {
    name: d.name.trim(),
    fee: paiseOf(d.fee) ?? 0,
    capacity: whole(d.capacity) ?? 1,
    minStudents: d.minStudents.trim() ? whole(d.minStudents) : null,
    slots: [...d.slots].sort(weekOrder),
    startDate: d.startDate,
    classes: d.ends === "classes" ? whole(d.classes) : null,
    endDate: d.ends === "date" ? d.endDate : null,
    onlineLink: online ? d.onlineLink.trim() : null,
    coachIds: d.coachIds,
  };
}

function Choose({ label, value, options, onChange, disabled }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void; disabled?: boolean }) {
  const id = useId();
  return (
    <div className={vendor.field}>
      <label htmlFor={id} className={vendor.label}>
        {label}
      </label>
      <select id={id} className={vendor.select} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Form({ rules, course, batch, coaches }: { rules: CoachingRules; course: VendorCourse; batch?: VendorBatch; coaches: TeamMember[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => draftOf(batch));
  const [length, setLength] = useState(() => batch?.slots[0]?.minutes ?? 60);
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const attempt = useRef(newIdempotencyKey());
  const [openedAt] = useState(Date.now);
  const today = istToday(openedAt);
  const online = course.mode === "online";
  const taken = batch ? batch.enrolled + batch.held : 0;
  const locked = !!batch && (taken > 0 || Date.parse(batch.firstAt) <= openedAt);
  const errors = errorsOf(draft, rules, online, locked, taken, today);
  const err = (field: string) => (shown ? errors[field] : undefined);
  const back = `/vendor/courses/${course.id}`;
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setSlot = (i: number, patch: Partial<Slot>) => setDraft((d) => ({ ...d, slots: d.slots.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const sorted = draft.slots.map((s, i) => ({ s, i })).sort((a, b) => weekOrder(a.s, b.s));
  const plan = planPreview({ slots: draft.slots, startDate: draft.startDate, classes: draft.ends === "classes" ? whole(draft.classes) : null, endDate: draft.ends === "date" ? draft.endDate : null }, rules.maxClasses);
  const known = new Set(coaches.map((c) => c.person.id));
  const gone = draft.coachIds.filter((id) => !known.has(id));

  const save = async () => {
    setShown(true);
    if (Object.keys(errors).length) return;
    setBusy(true);
    setFailure(null);
    try {
      const body = { ...inputOf(draft, online), coachIds: draft.coachIds.filter((id) => known.has(id)) };
      if (batch) {
        const { slots: _s, startDate: _d, classes: _c, endDate: _e, ...rest } = body;
        await updateBatch(batch.id, locked ? rest : body);
      } else {
        await addBatch(course.id, body, attempt.current);
      }
      router.push(back);
    } catch (e) {
      setFailure(formError(e).message);
      if (!(e instanceof ApiError && e.code === "NETWORK")) attempt.current = newIdempotencyKey();
      setBusy(false);
    }
  };

  return (
    <div className={vendor.page}>
      <Back href={back}>{course.title}</Back>
      <h1 className={vendor.title}>{batch ? `Edit ${batch.name}` : "New batch"}</h1>
      <form
        className={vendor.form}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Input label="Batch name" value={draft.name} onChange={(e) => set("name", e.target.value)} maxLength={60} placeholder="Like “Morning batch” or “Weekend”" error={err("name")} />
        <div className={vendor.pair} data-even>
          <Input
            label="Course fee (₹)"
            inputMode="decimal"
            value={draft.fee}
            onChange={(e) => set("fee", e.target.value)}
            placeholder="0 for free"
            hint={batch && taken ? "A new fee is for new students only." : "Paid in full when they enrol."}
            error={err("fee")}
          />
          <Input
            label="Seats"
            inputMode="numeric"
            value={draft.capacity}
            onChange={(e) => set("capacity", e.target.value)}
            maxLength={4}
            hint={taken ? `${taken} taken` : `Up to ${rules.maxBatchSize}`}
            error={err("capacity")}
          />
        </div>
        <Input
          label="Fewest students to run (optional)"
          inputMode="numeric"
          value={draft.minStudents}
          onChange={(e) => set("minStudents", e.target.value)}
          maxLength={4}
          hint={`If fewer enrol by ${rules.minimumHours} hours before the first class, the batch is cancelled and everyone gets a full refund.`}
          error={err("minStudents")}
        />

        <h2 className={vendor.section}>Weekly timetable</h2>
        {locked ? (
          <p className={vendor.note}>
            <Icon name="info" size={20} />
            <span>{`${scheduleText(draft.slots)}. The timetable is fixed once students have enrolled or the batch has started. Move, cancel or add single classes from Classes instead.`}</span>
          </p>
        ) : (
          <>
            <p className={vendor.faint}>Tap a time to add a class there, tap it again to remove it. Times are India time.</p>
            <Choose label="New classes last" value={String(length)} options={LENGTHS.map((m) => ({ value: String(m), label: lengthText(m) }))} onChange={(v) => setLength(Number(v))} />
            <WeekGrid slots={draft.slots} minutes={length} onChange={(slots) => set("slots", slots)} />
            {sorted.length > 0 && (
              <div>
                {sorted.map(({ s, i }) => (
                  <div key={`${s.day}-${s.start}-${i}`} className={styles.slotRow}>
                    <strong>{DAY_LONG[s.day]}</strong>
                    <Choose
                      label="Starts"
                      value={s.start}
                      options={(STARTS.includes(s.start) ? STARTS : [...STARTS, s.start].sort()).map((t) => ({ value: t, label: clockText(t) }))}
                      onChange={(v) => setSlot(i, { start: v })}
                    />
                    <Choose
                      label="Lasts"
                      value={String(s.minutes)}
                      options={(LENGTHS.includes(s.minutes) ? LENGTHS : [...LENGTHS, s.minutes].sort((a, b) => a - b)).map((m) => ({ value: String(m), label: lengthText(m) }))}
                      onChange={(v) => setSlot(i, { minutes: Number(v) })}
                    />
                    <button
                      type="button"
                      className={vendor.iconButton}
                      aria-label={`Remove ${DAY_LONG[s.day]} ${clockText(s.start)}`}
                      onClick={() => set("slots", draft.slots.filter((_, j) => j !== i))}
                    >
                      <Icon name="trash" size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {err("slots") && (
              <p className={vendor.error} role="alert">
                {err("slots")}
              </p>
            )}
            <Input label="First day" type="date" min={today} value={draft.startDate} onChange={(e) => set("startDate", e.target.value)} error={err("startDate")} />
            <Segmented label="It runs for" options={[...ENDS]} value={draft.ends} onChange={(v) => set("ends", v)} />
            {draft.ends === "classes" ? (
              <Input
                label="How many classes"
                inputMode="numeric"
                value={draft.classes}
                onChange={(e) => set("classes", e.target.value)}
                maxLength={3}
                hint={`Up to ${rules.maxClasses}`}
                error={err("classes")}
              />
            ) : (
              <Input label="Last day" type="date" min={draft.startDate || today} value={draft.endDate} onChange={(e) => set("endDate", e.target.value)} error={err("endDate")} />
            )}
            {plan.count > 0 && plan.first && plan.last && (
              <p className={vendor.note}>
                <Icon name="calendar" size={20} />
                <span>{`${plan.count > rules.maxClasses ? `More than ${rules.maxClasses}` : plan.count} ${plan.count === 1 ? "class" : "classes"}, ${dayLabel(plan.first)} to ${dayLabel(plan.last)}. ${scheduleText(draft.slots)}.`}</span>
              </p>
            )}
          </>
        )}

        {online && (
          <Input
            label="Meeting link"
            type="url"
            inputMode="url"
            value={draft.onlineLink}
            onChange={(e) => set("onlineLink", e.target.value)}
            autoCapitalize="none"
            spellCheck={false}
            hint={`Students see it ${rules.joinMinutes} minutes before each class.`}
            error={err("onlineLink")}
          />
        )}

        <div className={vendor.field}>
          <span className={vendor.label} id="coaches-label">
            Coaches (optional)
          </span>
          {coaches.length ? (
            <div className={vendor.chips} role="group" aria-labelledby="coaches-label">
              {coaches.map((c) => {
                const on = draft.coachIds.includes(c.person.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={vendor.chip}
                    aria-pressed={on}
                    onClick={() => set("coachIds", on ? draft.coachIds.filter((x) => x !== c.person.id) : [...draft.coachIds, c.person.id].slice(0, 10))}
                  >
                    {c.person.name}
                  </button>
                );
              })}
            </div>
          ) : null}
          <p className={vendor.faint}>
            {coaches.length
              ? "They take attendance and see this batch’s students. What else they can do is set in Team."
              : "Invite teachers to your team with “See their batches and students”, then pick them here."}
            {gone.length ? ` ${gone.length} coach${gone.length === 1 ? " is" : "es are"} no longer on the team and will be removed.` : ""}
          </p>
        </div>

        {failure && (
          <p className={vendor.error} role="alert">
            {failure}
          </p>
        )}
        <div className={vendor.actions}>
          <Button type="submit" size="lg" loading={busy}>
            {batch ? "Save batch" : "Add batch"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Ready({ courseId, batchId, rules }: { courseId: string; batchId?: string; rules: CoachingRules }) {
  const course = useLoad(() => getVendorCourse(courseId), courseId);
  const businessId = course.data?.business.id ?? "";
  const team = useLoad(() => (businessId ? getTeam(businessId) : Promise.resolve(null)), businessId);
  if (course.error && !course.data) return <Failed error={course.error} onRetry={course.reload} />;
  if (!course.data || (!team.data && !team.error)) return <Loading rows={5} />;
  const batch = batchId ? course.data.batches.find((b) => b.id === batchId) : undefined;
  if (batchId && !batch) return <Failed error={new ApiError(404, "NOT_FOUND", "That batch isn’t on this course.")} onRetry={course.reload} />;
  const coaches = (team.data?.members ?? []).filter((m) => m.status === "active" && m.permissions.includes("classes.view"));
  return <Form rules={rules} course={course.data} batch={batch} coaches={coaches} />;
}

/** Adding a batch to `courseId`, or changing `batchId`: fee, seats, a weekly timetable on a day × time grid, and coaches. */
export function BatchForm({ courseId, batchId }: { courseId: string; batchId?: string }) {
  const rules = useLoad(() => coachingRules(), "rules");
  if (rules.error && !rules.data) return <Failed error={rules.error} onRetry={rules.reload} />;
  if (!rules.data) return <Loading rows={5} />;
  return <Ready courseId={courseId} batchId={batchId} rules={rules.data} />;
}
