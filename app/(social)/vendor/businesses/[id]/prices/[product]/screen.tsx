"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ButtonLink, Icon, Input } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { Back, Failed, Loading } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { formError } from "@/lib/api/account";
import { OPTION_LABELS } from "@/lib/api/shops";
import { digitsOnly, getBusiness, paiseOf, rupeeInput, rupeesText, updatePod, vendorCatalog, type Business, type PodProductInfo } from "@/lib/api/vendor";
import styles from "@/components/vendor/vendor.module.css";

const extraKey = (option: string, value: string) => `${option}|${value}`;

interface TierRow {
  /** Stable across removals, for React keys. */
  key: number;
  from: string;
  price: string;
}

type Errors = Partial<Record<"base" | "page" | "minQuantity" | "turnaround" | "tiers", string>>;

let nextTierKey = 0;

function Form({ business, info, maxTiers, maxDays }: { business: Business; info: PodProductInfo; maxTiers: number; maxDays: number }) {
  const router = useRouter();
  const onSignedOut = useOnSignedOut();
  const current = business.pod?.prices.find((p) => p.product === info.id);
  const perPage = info.pricing === "per_page";
  const unit = perPage ? "page" : "unit";
  const [base, setBase] = useState(rupeesText(current?.basePrice));
  const [bw, setBw] = useState(rupeesText(current?.bw));
  const [color, setColor] = useState(rupeesText(current?.color));
  const [minQuantity, setMinQuantity] = useState(String(current?.minQuantity ?? info.minQuantity));
  const [turnaround, setTurnaround] = useState(current?.turnaroundDays == null ? "" : String(current.turnaroundDays));
  const [extras, setExtras] = useState<Record<string, string>>(() =>
    Object.fromEntries((current?.extras ?? []).map((e) => [extraKey(e.option, e.value), rupeesText(e.price)])),
  );
  const [tiers, setTiers] = useState<TierRow[]>(() => (current?.tiers ?? []).map((t) => ({ key: nextTierKey++, from: String(t.from), price: rupeesText(t.unitPrice) })));
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const check = (): Errors => {
    const e: Errors = {};
    if (perPage) {
      if (!(paiseOf(bw) ?? 0) && !(paiseOf(color) ?? 0)) e.page = "Set a black & white or a colour price per page.";
    } else if (!(paiseOf(base) ?? 0)) e.base = `Enter the price for one ${unit}.`;
    const min = Number(minQuantity);
    if (!Number.isInteger(min) || min < 1) e.minQuantity = `Enter at least 1 ${unit}.`;
    if (turnaround && Number(turnaround) > maxDays) e.turnaround = `At most ${maxDays} days.`;
    const froms = tiers.map((t) => Number(t.from));
    if (tiers.some((t) => Number(t.from) < 2 || !(paiseOf(t.price) ?? 0))) e.tiers = `Each bulk price needs a quantity of 2 or more and a price per ${unit}.`;
    else if (new Set(froms).size !== froms.length) e.tiers = "Each bulk price needs a different quantity.";
    return e;
  };

  const save = async () => {
    const found = check();
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length) return;
    const extraList = Object.entries(extras).flatMap(([key, text]) => {
      const price = paiseOf(text);
      if (!price) return [];
      const [option, value] = key.split("|") as [string, string];
      return [{ option, value, price }];
    });
    setSaving(true);
    try {
      await updatePod(business.id, {
        prices: [
          {
            product: info.id,
            minQuantity: Number(minQuantity),
            turnaroundDays: turnaround ? Number(turnaround) : null,
            ...(perPage ? { bw: paiseOf(bw), color: paiseOf(color) } : { basePrice: paiseOf(base) }),
            extras: extraList,
            tiers: tiers.map((t) => ({ from: Number(t.from), unitPrice: paiseOf(t.price)! })),
          },
        ],
      });
      router.push(`/vendor/businesses/${business.id}/prices`);
    } catch (err) {
      setSaving(false);
      if (!onSignedOut(err)) setFailure(formError(err).message);
    }
  };

  const rupees = (label: string, value: string, set: (v: string) => void, error?: string, hint?: string) => (
    <Input
      label={label}
      value={value}
      onChange={(e) => {
        set(rupeeInput(e.target.value));
        setErrors({});
      }}
      prefix="₹"
      inputMode="decimal"
      placeholder="0"
      error={error}
      hint={hint}
    />
  );

  const setTier = (key: number, changes: Partial<TierRow>) => setTiers((list) => list.map((t) => (t.key === key ? { ...t, ...changes } : t)));

  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <p className={styles.intro}>{info.description}</p>

      {perPage ? (
        <div className={styles.pair} data-even>
          {rupees("Black & white, per page", bw, setBw, errors.page)}
          {rupees("Colour, per page", color, setColor, undefined, "Leave one empty if you print only the other.")}
        </div>
      ) : (
        rupees(`Price per ${unit}`, base, setBase, errors.base, "Before any extras below.")
      )}

      <div className={styles.pair} data-even>
        <Input
          label={`Minimum ${unit}s`}
          value={minQuantity}
          onChange={(e) => setMinQuantity(digitsOnly(e.target.value, 6))}
          inputMode="numeric"
          error={errors.minQuantity}
        />
        <Input
          label="Ready in (days)"
          value={turnaround}
          onChange={(e) => setTurnaround(digitsOnly(e.target.value, 2))}
          inputMode="numeric"
          placeholder={String(business.pod?.turnaroundDays ?? 3)}
          hint="Empty uses your usual time."
          error={errors.turnaround}
        />
      </div>

      {info.options.map(({ option, values }) => (
        <section key={option} className={styles.form}>
          <div>
            <h2 className={styles.overline}>{`${OPTION_LABELS[option] ?? option} extras`}</h2>
            <p className={styles.faint}>{`Added to each ${unit}. Leave empty for no extra charge.`}</p>
          </div>
          <div className={styles.extras}>
            {values.map((value) => (
              <div key={value} className={styles.extra}>
                <span>{value}</span>
                <Input
                  label={`Extra for ${value}`}
                  className={styles.bare}
                  value={extras[extraKey(option, value)] ?? ""}
                  onChange={(e) => setExtras((x) => ({ ...x, [extraKey(option, value)]: rupeeInput(e.target.value) }))}
                  prefix="+₹"
                  inputMode="decimal"
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className={styles.form}>
        <div>
          <h2 className={styles.overline}>Bulk prices</h2>
          <p className={styles.faint}>{`A lower price per ${unit} from a quantity, such as ₹180 each from 50.`}</p>
        </div>
        {tiers.map((tier) => (
          <div key={tier.key} className={styles.tier}>
            <Input label={`From (${unit}s)`} value={tier.from} onChange={(e) => setTier(tier.key, { from: digitsOnly(e.target.value, 6) })} inputMode="numeric" />
            <Input label={`Price per ${unit}`} value={tier.price} onChange={(e) => setTier(tier.key, { price: rupeeInput(e.target.value) })} prefix="₹" inputMode="decimal" />
            <button type="button" className={styles.iconButton} aria-label="Remove this bulk price" onClick={() => setTiers((list) => list.filter((t) => t.key !== tier.key))}>
              <Icon name="trash" size={18} />
            </button>
          </div>
        ))}
        {errors.tiers && (
          <p className={styles.error} role="alert">
            {errors.tiers}
          </p>
        )}
        {tiers.length < maxTiers && (
          <div>
            <button type="button" className={styles.link} onClick={() => setTiers((list) => [...list, { key: nextTierKey++, from: "", price: "" }])}>
              Add a bulk price
            </button>
          </div>
        )}
      </section>

      {failure && (
        <p className={styles.error} role="alert">
          {failure}
        </p>
      )}
      <div>
        <Button type="submit" size="lg" loading={saving}>
          Save prices
        </Button>
      </div>
    </form>
  );
}

/** Prices for one print product: per unit (or per page for documents), extras by option and bulk tiers. Same as the app. */
export function PodPriceScreen({ id, product }: { id: string; product: string }) {
  const business = useLoad(() => getBusiness(id), id);
  const catalog = useLoad(() => vendorCatalog());
  const error = business.error ?? catalog.error;
  if (error && !(business.data && catalog.data)) {
    return (
      <Failed
        error={error}
        onRetry={() => {
          if (business.error) business.reload();
          if (catalog.error) catalog.reload();
        }}
      />
    );
  }
  if (!business.data || !catalog.data) return <Loading rows={5} />;
  const info = catalog.data.podProducts.find((p) => p.id === product);
  const ours = !!info && !!business.data.pod?.products.includes(info.id);

  return (
    <div className={styles.page}>
      <Back href={`/vendor/businesses/${id}/prices`}>Prices</Back>
      <h1 className={styles.title}>{info?.label ?? "Prices"}</h1>
      {ours ? (
        <Form business={business.data} info={info!} maxTiers={catalog.data.limits.tiers} maxDays={catalog.data.limits.turnaroundDays} />
      ) : (
        <Empty title="Not one of your products">
          <p>Add it under Products & delivery first.</p>
          <ButtonLink href={`/vendor/businesses/${id}/products`} variant="secondary">
            Products & delivery
          </ButtonLink>
        </Empty>
      )}
    </div>
  );
}
