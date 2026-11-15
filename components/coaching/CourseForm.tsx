"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button, Input, Switch } from "@/components/ui";
import { Back, Failed, Loading, TextArea } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { formError } from "@/lib/api/account";
import { ApiError, newIdempotencyKey } from "@/lib/api/client";
import { coachingRules, createCourse, getVendorCourse, updateCourse, type CoachingRules, type CourseCategory, type CourseInput, type CourseMode, type VendorCourse } from "@/lib/api/coaching";
import { money } from "@/lib/api/shops";
import { CATEGORIES, CATEGORY_LABEL, MODE_LABEL } from "@/lib/coaching";
import { paiseOf } from "@/lib/events";
import vendor from "@/components/vendor/vendor.module.css";

interface Draft {
  title: string;
  description: string;
  category: CourseCategory | null;
  mode: CourseMode;
  venueName: string;
  address: string;
  city: string;
  demo: boolean;
  demoFee: string;
  demoSeats: string;
  certificate: string;
}

const rupees = (paise: number) => (paise % 100 ? (paise / 100).toFixed(2) : String(paise / 100));
const whole = (text: string) => (/^\d+$/.test(text.trim()) ? Number(text.trim()) : null);

function draftOf(course?: VendorCourse): Draft {
  return {
    title: course?.title ?? "",
    description: course?.description ?? "",
    category: course?.category ?? null,
    mode: course?.mode ?? "offline",
    venueName: course?.venue?.name ?? "",
    address: course?.venue?.address ?? "",
    city: course?.venue?.city ?? "",
    demo: !!course?.demo,
    demoFee: course?.demo ? rupees(course.demo.fee) : "0",
    demoSeats: String(course?.demoSeats ?? 3),
    certificate: course ? String(course.certificatePercent) : "",
  };
}

function errorsOf(d: Draft, rules: CoachingRules): Record<string, string> {
  const e: Record<string, string> = {};
  if (!d.category) e.category = "Pick what it teaches";
  if (d.title.trim().length < 3) e.title = "At least 3 characters";
  if (d.mode === "offline") {
    if (d.venueName.trim().length < 2) e.venueName = "The institute or hall’s name";
    if (d.address.trim().length < 5) e.address = "Street and area, so students find it";
    if (d.city.trim().length < 2) e.city = "The city";
  }
  if (d.demo) {
    const fee = paiseOf(d.demoFee);
    if (fee === null) e.demoFee = "An amount like 200, or 0 for free";
    else if (fee > rules.maxDemoFee) e.demoFee = `Up to ${money(rules.maxDemoFee)}`;
    const seats = whole(d.demoSeats);
    if (!seats || seats > rules.maxDemoSeats) e.demoSeats = `From 1 to ${rules.maxDemoSeats}`;
  }
  if (d.certificate.trim()) {
    const p = whole(d.certificate);
    if (!p || p > 100) e.certificate = "A percent from 1 to 100";
  }
  return e;
}

function inputOf(d: Draft): CourseInput {
  const certificate = whole(d.certificate);
  return {
    title: d.title.trim(),
    description: d.description.trim() || null,
    category: d.category!,
    mode: d.mode,
    venue: d.mode === "offline" ? { name: d.venueName.trim(), address: d.address.trim(), city: d.city.trim() } : null,
    demo: d.demo ? { fee: paiseOf(d.demoFee) ?? 0, seats: whole(d.demoSeats) ?? 1 } : null,
    ...(certificate ? { certificatePercent: certificate } : {}),
  };
}

function Form({ rules, course, businessId }: { rules: CoachingRules; course?: VendorCourse; businessId?: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => draftOf(course));
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const attempt = useRef(newIdempotencyKey());
  const errors = errorsOf(draft, rules);
  const err = (field: string) => (shown ? errors[field] : undefined);
  const modeLocked = !!course && course.batches.length > 0;
  const back = course ? `/vendor/courses/${course.id}` : `/vendor/businesses/${businessId}/courses`;
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const save = async () => {
    setShown(true);
    if (Object.keys(errors).length) return;
    setBusy(true);
    setFailure(null);
    try {
      const body = inputOf(draft);
      if (course) {
        await updateCourse(course.id, modeLocked ? { ...body, mode: undefined } : body);
        router.push(`/vendor/courses/${course.id}`);
      } else {
        const created = await createCourse(businessId!, body, attempt.current);
        router.replace(`/vendor/courses/${created.id}?fresh=1`);
      }
    } catch (e) {
      setFailure(formError(e).message);
      if (!(e instanceof ApiError && e.code === "NETWORK")) attempt.current = newIdempotencyKey();
      setBusy(false);
    }
  };

  return (
    <div className={vendor.page}>
      <Back href={back}>{course ? "Course" : "Courses"}</Back>
      <h1 className={vendor.title}>{course ? "Edit course" : "New course"}</h1>
      <form
        className={vendor.form}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className={vendor.field}>
          <span className={vendor.label} id="category-label">
            What does it teach?
          </span>
          <div className={vendor.chips} role="group" aria-labelledby="category-label">
            {CATEGORIES.map((c) => (
              <button key={c} type="button" className={vendor.chip} aria-pressed={draft.category === c} onClick={() => set("category", c)}>
                {CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
          {err("category") && (
            <p className={vendor.error} role="alert">
              {err("category")}
            </p>
          )}
        </div>
        <Input label="Course name" value={draft.title} onChange={(e) => set("title", e.target.value)} maxLength={80} placeholder="Like “Class 10 Maths” or “Guitar for beginners”" error={err("title")} />
        <TextArea
          label="About the course (optional)"
          value={draft.description}
          onChange={(v) => set("description", v)}
          max={2000}
          placeholder="What students learn, who it’s for, what to bring"
        />

        <div className={vendor.field}>
          <span className={vendor.label} id="mode-label">
            Where are classes?
          </span>
          <div className={vendor.chips} role="group" aria-labelledby="mode-label">
            {(["offline", "online"] as const).map((m) => (
              <button key={m} type="button" className={vendor.chip} aria-pressed={draft.mode === m} disabled={modeLocked} onClick={() => set("mode", m)}>
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>
          <p className={vendor.faint}>
            {modeLocked
              ? "Can’t change once the course has a batch."
              : draft.mode === "online"
                ? "Each batch gets its own meeting link. Students see it shortly before each class."
                : "Students come to your venue."}
          </p>
        </div>
        {draft.mode === "offline" && (
          <>
            <Input label="Centre name" value={draft.venueName} onChange={(e) => set("venueName", e.target.value)} maxLength={80} placeholder="Like “Bright Minds, Madhapur”" error={err("venueName")} />
            <Input label="Address" value={draft.address} onChange={(e) => set("address", e.target.value)} maxLength={200} placeholder="Building, street, area" error={err("address")} />
            <Input label="City" value={draft.city} onChange={(e) => set("city", e.target.value)} maxLength={60} autoComplete="address-level2" error={err("city")} />
            {course && course.counts.students > 0 && <p className={vendor.faint}>Enrolled students are told when the venue changes.</p>}
          </>
        )}

        <div className={vendor.switches}>
          <Switch checked={draft.demo} onChange={(v) => set("demo", v)} description="One trial class per student, in any upcoming class of a batch">
            Offer a demo class
          </Switch>
        </div>
        {draft.demo && (
          <div className={vendor.pair} data-even>
            <Input label="Demo fee (₹)" inputMode="decimal" value={draft.demoFee} onChange={(e) => set("demoFee", e.target.value)} hint="0 for free" error={err("demoFee")} />
            <Input
              label="Seats per class"
              inputMode="numeric"
              value={draft.demoSeats}
              onChange={(e) => set("demoSeats", e.target.value)}
              maxLength={2}
              hint={`Up to ${rules.maxDemoSeats}`}
              error={err("demoSeats")}
            />
          </div>
        )}

        <Input
          label="Attendance for a certificate (%)"
          inputMode="numeric"
          value={draft.certificate}
          onChange={(e) => set("certificate", e.target.value)}
          maxLength={3}
          placeholder={String(rules.certificatePercent)}
          hint={`Students who attend this share of classes get a certificate after the last one. Ruxstar’s usual is ${rules.certificatePercent}%.`}
          error={err("certificate")}
        />

        {failure && (
          <p className={vendor.error} role="alert">
            {failure}
          </p>
        )}
        {!course && <p className={vendor.faint}>It’s saved as a draft. Add a photo and batches, then publish it from the next screen.</p>}
        <div className={vendor.actions}>
          <Button type="submit" size="lg" loading={busy}>
            {course ? "Save changes" : "Save as draft"}
          </Button>
        </div>
      </form>
    </div>
  );
}

/** Making a course for `businessId` or changing `courseId`. A new course is saved as a draft. */
export function CourseForm({ businessId, courseId }: { businessId?: string; courseId?: string }) {
  const rules = useLoad(() => coachingRules(), "rules");
  const course = useLoad(() => (courseId ? getVendorCourse(courseId) : Promise.resolve(null)), courseId ?? "new");
  const failed = rules.error ?? course.error;
  if (rules.data && (!courseId || course.data)) return <Form rules={rules.data} course={course.data ?? undefined} businessId={businessId} />;
  if (failed)
    return (
      <Failed
        error={failed}
        onRetry={() => {
          rules.reload();
          course.reload();
        }}
      />
    );
  return <Loading rows={4} />;
}
