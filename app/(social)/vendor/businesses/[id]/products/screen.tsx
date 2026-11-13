"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Icon, Input, Switch } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { Back, Failed, Loading, Select, TextArea } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { formError } from "@/lib/api/account";
import { paiseOf, rupeeInput, rupeesText, shopDesk, titleCase, vendorCatalog, type Business, type BusinessCatalog, type PodProduct } from "@/lib/api/vendor";
import styles from "@/components/vendor/vendor.module.css";

const OTHER_CITY = "Other city";
const NOTES_MAX = 1000;

function Form({ id, team, business, catalog }: { id: string; team: boolean; business: Business; catalog: BusinessCatalog }) {
  const router = useRouter();
  const onSignedOut = useOnSignedOut();
  const pod = business.pod!;
  const home = business.location?.city.toLowerCase();
  const [products, setProducts] = useState<PodProduct[]>(pod.products);
  const [serveAll, setServeAll] = useState(pod.serveAll);
  const [cities, setCities] = useState<string[]>(() => (pod.cities.length || pod.serveAll || !home ? pod.cities : [home]));
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState("");
  const [turnaround, setTurnaround] = useState(pod.turnaroundDays);
  const [minOrder, setMinOrder] = useState(pod.minOrder ? rupeesText(pod.minOrder) : "");
  const [notes, setNotes] = useState(pod.notes ?? "");
  const [problem, setProblem] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const stateCities = catalog.states.find((s) => s.name === business.location?.state)?.cities ?? [];
  const suggestions = stateCities.filter((c) => !cities.includes(c.toLowerCase()));
  const limit = catalog.limits.cities;
  const maxDays = catalog.limits.turnaroundDays;

  const toggle = (product: PodProduct, on: boolean) => {
    setProducts((list) => (on ? [...list, product] : list.filter((p) => p !== product)));
    setProblem(null);
  };

  const addCity = (city: string) => {
    const key = city.trim().toLowerCase();
    if (key.length < 2 || cities.includes(key) || cities.length >= limit) return;
    setCities((list) => [...list, key]);
    setProblem(null);
  };

  const addTyped = () => {
    addCity(typed);
    setTyped("");
    setTyping(false);
  };

  const save = async () => {
    setFailure(null);
    if (!products.length) return setProblem("Choose at least one product.");
    if (!serveAll && !cities.length) return setProblem("Add a city you deliver to, or turn on every city.");
    setSaving(true);
    try {
      const desk = shopDesk(team);
      await desk.updatePod(id, { products, serveAll, cities, turnaroundDays: turnaround, minOrder: paiseOf(minOrder) ?? 0, notes: notes.trim() || null });
      router.push(desk.home(id));
    } catch (err) {
      setSaving(false);
      if (!onSignedOut(err)) setFailure(formError(err).message);
    }
  };

  const dropped = pod.products.filter((p) => !products.includes(p) && pod.prices.some((x) => x.product === p));

  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <h2 className={styles.overline}>What you print</h2>
      <div className={styles.switches}>
        {catalog.podProducts.map((info) => (
          <Switch key={info.id} checked={products.includes(info.id)} onChange={(on) => toggle(info.id, on)} description={info.description}>
            {info.label}
          </Switch>
        ))}
      </div>
      {dropped.length > 0 && <p className={styles.warn}>Prices you set for products you turn off are removed when you save.</p>}

      <h2 className={styles.overline}>Where you deliver</h2>
      <div className={styles.switches}>
        <Switch checked={serveAll} onChange={setServeAll} description="Ship anywhere in India">
          Every city
        </Switch>
      </div>
      {!serveAll && (
        <>
          {cities.length > 0 && (
            <div className={styles.chips}>
              {cities.map((city) => (
                <button
                  key={city}
                  type="button"
                  className={styles.chip}
                  aria-label={`Remove ${titleCase(city)}`}
                  onClick={() => setCities((list) => list.filter((c) => c !== city))}
                >
                  {titleCase(city)}
                  <Icon name="close" size={14} />
                </button>
              ))}
            </div>
          )}
          {cities.length < limit ? (
            <Select
              label="Add a city"
              value=""
              options={[...suggestions, OTHER_CITY]}
              placeholder={business.location ? `Cities in ${business.location.state}, or another` : "Choose a city"}
              onChange={(city) => (city === OTHER_CITY ? setTyping(true) : addCity(city))}
            />
          ) : (
            <p className={styles.faint}>{`You can deliver to up to ${limit} cities. Turn on every city to ship anywhere.`}</p>
          )}
          {typing && (
            <div className={styles.inline}>
              <Input
                label="Other city"
                value={typed}
                maxLength={60}
                autoFocus
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  addTyped();
                }}
              />
              <Button variant="secondary" onClick={addTyped}>
                Add
              </Button>
            </div>
          )}
        </>
      )}

      <h2 className={styles.overline}>Orders</h2>
      <div className={styles.spread}>
        <span className={styles.identity}>
          <span className={styles.label}>Ready in (days)</span>
          <span className={styles.faint}>{turnaround === 0 ? "Same day" : `${turnaround} day${turnaround === 1 ? "" : "s"} after the order`}</span>
        </span>
        <span className={styles.stepper} role="group" aria-label="Days to get an order ready">
          <button type="button" className={styles.iconButton} aria-label="One day less" disabled={turnaround <= 0} onClick={() => setTurnaround((d) => d - 1)}>
            <Icon name="minus" size={18} />
          </button>
          <output aria-live="polite">{turnaround}</output>
          <button type="button" className={styles.iconButton} aria-label="One day more" disabled={turnaround >= maxDays} onClick={() => setTurnaround((d) => d + 1)}>
            <Icon name="plus" size={18} />
          </button>
        </span>
      </div>
      <Input
        label="Minimum order (optional)"
        value={minOrder}
        onChange={(e) => setMinOrder(rupeeInput(e.target.value))}
        prefix="₹"
        inputMode="decimal"
        placeholder="0"
        hint="Orders below this can't be placed."
      />
      <TextArea label="Notes for customers (optional)" value={notes} onChange={setNotes} placeholder="File formats you accept, pickup timings…" max={NOTES_MAX} />

      {problem && (
        <p className={styles.error} role="alert">
          {problem}
        </p>
      )}
      {failure && (
        <p className={styles.error} role="alert">
          {failure}
        </p>
      )}
      <div>
        <Button type="submit" size="lg" loading={saving}>
          Save
        </Button>
      </div>
    </form>
  );
}

/** Print on demand setup: which products, where it delivers, and how fast. Same as the app. `team` opens it from Work, by place id. */
export function PodProductsScreen({ id, team = false }: { id: string; team?: boolean }) {
  const business = useLoad(() => shopDesk(team).get(id), id);
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
  if (!business.data || !catalog.data) return <Loading rows={6} />;
  return (
    <div className={styles.page}>
      <Back href={shopDesk(team).home(id)}>{business.data.name}</Back>
      <h1 className={styles.title}>Products & delivery</h1>
      {business.data.pod ? <Form id={id} team={team} business={business.data} catalog={catalog.data} /> : <Empty title="Only print shops have products" />}
    </div>
  );
}
