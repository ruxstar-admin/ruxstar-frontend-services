"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button, ButtonLink, Icon, Input } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { Back, Failed, Loading, TextArea } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { formError } from "@/lib/api/account";
import { ApiError, keepIdempotencyKey, newIdempotencyKey } from "@/lib/api/client";
import { createGig, myGig, updateGig, type GigsRules, type MyFreelancer, type MyGig } from "@/lib/api/gigs";
import {
  emptyGig,
  emptyPackage,
  GIG_STEPS,
  gigDraftOf,
  gigErrors,
  newQuestion,
  nextTier,
  percentText,
  priceRangeText,
  rupeeInput,
  stepOfError,
  TIER_LABEL,
  toGigInput,
  type GigDraft,
  type PackageDraft,
  type QuestionDraft,
} from "@/lib/gigs";
import { KeyedSelect } from "./fields";
import { loadGigsRules, loadMyFreelancer } from "./use-gigs";
import vendor from "@/components/vendor/vendor.module.css";
import styles from "./gigs.module.css";

type Limits = Pick<GigsRules, "minPrice" | "maxPrice" | "minDays" | "maxDays" | "maxRevisions">;

/** One package of a gig being edited: its name, what's included, price, days and revisions. */
function PackageFields({
  pack,
  rules,
  errors,
  onChange,
  onRemove,
}: {
  pack: PackageDraft;
  rules: Limits;
  errors: Record<string, string | undefined>;
  onChange: (patch: Partial<PackageDraft>) => void;
  /** Only the last package can go, so the tiers stay in order. */
  onRemove: (() => void) | null;
}) {
  const err = (field: keyof PackageDraft) => errors[`${pack.tier}.${field}`];
  return (
    <section className={vendor.card}>
      <div className={vendor.cardHead}>
        <span>{TIER_LABEL[pack.tier]}</span>
        {onRemove && (
          <button type="button" className={vendor.link} data-muted onClick={onRemove}>
            Remove
          </button>
        )}
      </div>
      <Input label="Name (optional)" value={pack.name} onChange={(e) => onChange({ name: e.target.value })} maxLength={40} placeholder={TIER_LABEL[pack.tier]} error={err("name")} />
      <TextArea
        label="What’s included"
        value={pack.description}
        onChange={(v) => onChange({ description: v })}
        max={600}
        placeholder="Like “1 logo concept, PNG and SVG files”"
        error={err("description")}
      />
      <Input
        label="Price (₹)"
        inputMode="decimal"
        value={pack.price}
        onChange={(e) => onChange({ price: rupeeInput(e.target.value) })}
        hint={priceRangeText(rules.minPrice, rules.maxPrice)}
        error={err("price")}
      />
      <div className={vendor.pair} data-even>
        <Input
          label="Days to deliver"
          inputMode="numeric"
          value={pack.deliveryDays}
          onChange={(e) => onChange({ deliveryDays: e.target.value.replace(/\D/g, "") })}
          maxLength={3}
          error={err("deliveryDays")}
        />
        <Input
          label="Revisions"
          inputMode="numeric"
          value={pack.revisions}
          onChange={(e) => onChange({ revisions: e.target.value.replace(/\D/g, "") })}
          maxLength={2}
          error={err("revisions")}
        />
      </div>
    </section>
  );
}

function Editor({ rules, me, gig }: { rules: GigsRules; me: MyFreelancer; gig: MyGig | null }) {
  const router = useRouter();
  const [draft, setDraft] = useState<GigDraft>(() =>
    gig ? gigDraftOf(gig) : emptyGig(rules.categories.some((c) => c.key === me.category) ? me.category : (rules.categories[0]?.key ?? ""), rules),
  );
  const [step, setStep] = useState(0);
  const [shown, setShown] = useState<boolean[]>([false, false, false]);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const attempt = useRef<{ sig: string; key: string } | null>(null);
  const errors = gigErrors(draft, rules);
  const err = (key: string) => (shown[step] ? errors[key] : undefined);
  const stepHasErrors = (at: number) => Object.keys(errors).some((k) => stepOfError({ [k]: errors[k]! }) === GIG_STEPS[at]!.key);
  const set = <K extends keyof GigDraft>(key: K, value: GigDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setPackage = (tier: PackageDraft["tier"], patch: Partial<PackageDraft>) =>
    setDraft((d) => ({ ...d, packages: d.packages.map((p) => (p.tier === tier ? { ...p, ...patch } : p)) }));
  const setQuestion = (key: string, patch: Partial<QuestionDraft>) => setDraft((d) => ({ ...d, questions: d.questions.map((q) => (q.key === key ? { ...q, ...patch } : q)) }));
  const tier = nextTier(draft, rules.maxPackages);
  const last = step === GIG_STEPS.length - 1;
  const back = gig ? `/freelance/gigs/${gig.id}` : "/freelance";

  const next = () => {
    setShown((s) => s.map((v, i) => (i === step ? true : v)));
    if (!stepHasErrors(step)) setStep(step + 1);
  };

  const save = async () => {
    setShown([true, true, true]);
    const wrong = stepOfError(errors);
    if (wrong) {
      setStep(GIG_STEPS.findIndex((s) => s.key === wrong));
      return;
    }
    setBusy(true);
    setFailure(null);
    const body = toGigInput(draft);
    try {
      if (gig) {
        await updateGig(gig.id, body);
        router.push(back);
      } else {
        const sig = JSON.stringify(body);
        if (attempt.current?.sig !== sig) attempt.current = { sig, key: newIdempotencyKey() };
        const made = await createGig(body, attempt.current.key);
        router.replace(`/freelance/gigs/${made.id}?fresh=1`);
      }
    } catch (e) {
      if (!keepIdempotencyKey(e)) attempt.current = null;
      setFailure(formError(e).message);
      setBusy(false);
    }
  };

  return (
    <div className={vendor.page}>
      <Back href={back}>{gig ? gig.title : "Freelancing"}</Back>
      <h1 className={vendor.title}>{gig ? "Edit gig" : "New gig"}</h1>
      <ol className={styles.steps} aria-label="Steps">
        {GIG_STEPS.map((s, i) => (
          <li key={s.key} aria-current={i === step ? "step" : undefined}>
            {s.label}
          </li>
        ))}
      </ol>
      {step > 0 && (
        <div>
          <button type="button" className={vendor.link} onClick={() => setStep(step - 1)}>
            ‹ Back a step
          </button>
        </div>
      )}

      <form
        className={vendor.form}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (last) void save();
          else next();
        }}
      >
        {step === 0 && (
          <>
            <Input label="Title" value={draft.title} onChange={(e) => set("title", e.target.value)} maxLength={80} placeholder="Like “I will design a logo for your brand”" error={err("title")} />
            <KeyedSelect label="Category" value={draft.category} options={rules.categories} onChange={(v) => set("category", v)} error={err("category")} />
            <TextArea
              label="Description"
              value={draft.description}
              onChange={(v) => set("description", v)}
              max={3000}
              placeholder="What you do, how you work, what you need from the customer"
              error={err("description")}
            />
          </>
        )}

        {step === 1 && (
          <>
            <p className={vendor.muted}>
              {rules.maxPackages > 1
                ? `Up to ${Math.min(rules.maxPackages, 3)} packages, from the simplest to the fullest. Customers compare them side by side.`
                : "One package: what customers get and what it costs."}
            </p>
            {err("packages") && (
              <p className={vendor.error} role="alert">
                {err("packages")}
              </p>
            )}
            {draft.packages.map((p, i) => (
              <PackageFields
                key={p.tier}
                pack={p}
                rules={rules}
                errors={shown[1] ? errors : {}}
                onChange={(patch) => setPackage(p.tier, patch)}
                onRemove={i > 0 && i === draft.packages.length - 1 ? () => set("packages", draft.packages.slice(0, -1)) : null}
              />
            ))}
            {tier && (
              <div>
                <Button variant="secondary" icon={<Icon name="plus" size={16} />} onClick={() => set("packages", [...draft.packages, emptyPackage(tier, rules)])}>
                  {`Add ${tier === "standard" ? "a Standard" : "a Premium"} package`}
                </Button>
              </div>
            )}
            <p className={vendor.faint}>{`Ruxstar keeps ${percentText(rules.commissionBps)} of the price. Days count from when you accept.`}</p>
          </>
        )}

        {step === 2 && (
          <>
            <p className={vendor.muted}>Ask what you need to start, like their brand name or the colours they like. Customers answer when they order.</p>
            {draft.questions.map((q, i) => (
              <section key={q.key} className={vendor.card}>
                <div className={vendor.cardHead}>
                  <span>{`Question ${i + 1}`}</span>
                  <button type="button" className={vendor.link} data-muted aria-label={`Remove question ${i + 1}`} onClick={() => set("questions", draft.questions.filter((x) => x.key !== q.key))}>
                    Remove
                  </button>
                </div>
                <Input label="Question" value={q.text} onChange={(e) => setQuestion(q.key, { text: e.target.value })} maxLength={200} error={err(`q.${q.key}`)} />
                <label className={styles.check}>
                  <input type="checkbox" checked={q.required} onChange={(e) => setQuestion(q.key, { required: e.target.checked })} />
                  They must answer
                </label>
              </section>
            ))}
            {draft.questions.length < rules.limits.questions && (
              <div>
                <button type="button" className={vendor.link} onClick={() => set("questions", [...draft.questions, newQuestion()])}>
                  Add a question
                </button>
              </div>
            )}
            <p className={vendor.note}>
              <Icon name="info" size={20} />
              <span>{gig ? "Orders already placed keep the packages and questions they were made with." : "It’s saved as a draft. Add photos, then publish it."}</span>
            </p>
          </>
        )}

        {failure && (
          <p className={vendor.error} role="alert">
            {failure}
          </p>
        )}
        <div className={vendor.actions}>
          <Button type="submit" size="lg" loading={busy}>
            {last ? (gig ? "Save changes" : "Save as a draft") : "Continue"}
          </Button>
        </div>
      </form>
    </div>
  );
}

/** Making a gig, or editing one (`id`): what it is, its packages, and questions for the customer. */
export function GigEditor({ id }: { id?: string }) {
  const { data, error, reload } = useLoad(
    () => Promise.all([loadGigsRules(), loadMyFreelancer(), id ? myGig(id) : Promise.resolve(null)]).then(([rules, me, gig]) => ({ rules, me, gig })),
    id ?? "new",
  );
  if (data?.me) return <Editor rules={data.rules} me={data.me} gig={data.gig} />;
  if (data) {
    return (
      <Empty title="Start freelancing first">
        <p>Gigs belong to your freelancer profile.</p>
        <ButtonLink href="/freelance" variant="secondary">
          Freelancing
        </ButtonLink>
      </Empty>
    );
  }
  if (error instanceof ApiError && error.status === 404) {
    return (
      <Empty title="Gig not found">
        <ButtonLink href="/freelance" variant="secondary">
          Freelancing
        </ButtonLink>
      </Empty>
    );
  }
  if (error) return <Failed error={error} onRetry={reload} />;
  return <Loading rows={4} />;
}
