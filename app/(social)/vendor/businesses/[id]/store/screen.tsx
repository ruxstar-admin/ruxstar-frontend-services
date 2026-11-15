"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Icon, Input, Switch } from "@/components/ui";
import { useOnSignedOut } from "@/components/social/session";
import { Back, Failed, Loading, TextArea } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { formError } from "@/lib/api/account";
import { storeRules, storeSetup, saveStoreSetup, type StoreSetupView } from "@/lib/api/store";
import { paiseOf, rupeeInput, rupeesText, vendorCatalog, type BusinessCatalog } from "@/lib/api/vendor";
import { feeLine } from "@/lib/store";
import styles from "@/components/vendor/vendor.module.css";

const NOTES_MAX = 1000;
const MAX_RADIUS_KM = 50;

function KmStepper({ label, value, min, max, onChange, line }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void; line: string }) {
  return (
    <div className={styles.spread}>
      <span className={styles.identity}>
        <span className={styles.label}>{label}</span>
        <span className={styles.faint}>{line}</span>
      </span>
      <span className={styles.stepper} role="group" aria-label={label}>
        <button type="button" className={styles.iconButton} aria-label="One km less" disabled={value <= min} onClick={() => onChange(value - 1)}>
          <Icon name="minus" size={18} />
        </button>
        <output aria-live="polite">{value}</output>
        <button type="button" className={styles.iconButton} aria-label="One km more" disabled={value >= max} onClick={() => onChange(value + 1)}>
          <Icon name="plus" size={18} />
        </button>
      </span>
    </div>
  );
}

function Form({ id, setup, catalog, releaseHours }: { id: string; setup: StoreSetupView; catalog: BusinessCatalog; releaseHours: number | null }) {
  const router = useRouter();
  const onSignedOut = useOnSignedOut();
  const [delivery, setDelivery] = useState(setup.delivery);
  const [pickup, setPickup] = useState(setup.pickup);
  const [anywhere, setAnywhere] = useState(setup.radiusKm === null);
  const [radius, setRadius] = useState(setup.radiusKm ?? 5);
  const [feeBase, setFeeBase] = useState(setup.deliveryFee.base ? rupeesText(setup.deliveryFee.base) : "");
  const [feeKm, setFeeKm] = useState(setup.deliveryFee.includedKm);
  const [feePerKm, setFeePerKm] = useState(setup.deliveryFee.perKm ? rupeesText(setup.deliveryFee.perKm) : "");
  const [minOrder, setMinOrder] = useState(setup.minOrder ? rupeesText(setup.minOrder) : "");
  const [returns, setReturns] = useState(setup.returns);
  const [notes, setNotes] = useState(setup.notes ?? "");
  const [problem, setProblem] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const feeMax = catalog.limits.deliveryFee;
  const base = paiseOf(feeBase) ?? 0;
  const perKm = paiseOf(feePerKm) ?? 0;

  const save = async () => {
    setFailure(null);
    if (!delivery && !pickup) return setProblem("Turn on delivery, pickup or both, so customers can get their order.");
    if (base > feeMax.base || perKm > feeMax.perKm) {
      return setProblem(`Ruxstar allows a delivery charge of up to ₹${rupeesText(feeMax.base)}, plus ₹${rupeesText(feeMax.perKm)} a km.`);
    }
    setProblem(null);
    setSaving(true);
    try {
      await saveStoreSetup(id, {
        delivery,
        pickup,
        radiusKm: anywhere ? null : radius,
        deliveryFee: { base, includedKm: perKm ? feeKm : 0, perKm },
        minOrder: paiseOf(minOrder) ?? 0,
        returns,
        notes: notes.trim() || null,
      });
      router.push(`/vendor/businesses/${id}`);
    } catch (err) {
      setSaving(false);
      if (!onSignedOut(err)) setFailure(formError(err).message);
    }
  };

  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <h2 className={styles.overline}>How customers get it</h2>
      <div className={styles.switches}>
        <Switch checked={delivery} onChange={setDelivery} description="Your team or a Ruxstar delivery partner takes it to them. You choose for each order.">
          Delivery
        </Switch>
        <Switch checked={pickup} onChange={setPickup} description="Customers collect it from your shop. Free for them.">
          Pickup from the shop
        </Switch>
      </div>

      {delivery && (
        <>
          <h2 className={styles.overline}>Where you deliver</h2>
          <div className={styles.switches}>
            <Switch checked={anywhere} onChange={setAnywhere} description="Anywhere in your city">
              The whole city
            </Switch>
          </div>
          {!anywhere && (
            <KmStepper
              label="Up to (km by road)"
              value={radius}
              min={1}
              max={MAX_RADIUS_KM}
              onChange={setRadius}
              line={`Customers further than ${radius} km can’t choose delivery`}
            />
          )}

          <h2 className={styles.overline}>Delivery charge</h2>
          <Input
            label="Base charge (₹)"
            value={feeBase}
            onChange={(e) => setFeeBase(rupeeInput(e.target.value))}
            inputMode="decimal"
            placeholder="0"
            hint={`Up to ₹${rupeesText(feeMax.base)}. Leave both at 0 for free delivery.`}
          />
          <Input
            label="Per km (₹, optional)"
            value={feePerKm}
            onChange={(e) => setFeePerKm(rupeeInput(e.target.value))}
            inputMode="decimal"
            placeholder="0"
            hint={`Up to ₹${rupeesText(feeMax.perKm)} a km, by road from your shop.`}
          />
          {perKm > 0 && (
            <KmStepper
              label="Km in the base charge"
              value={feeKm}
              min={0}
              max={50}
              onChange={setFeeKm}
              line={feeKm === 0 ? `₹${rupeesText(perKm)} for every km` : `₹${rupeesText(perKm)} a km after the first ${feeKm} km`}
            />
          )}
          <p className={styles.faint}>{`Customers see: ${feeLine({ base, includedKm: perKm ? feeKm : 0, perKm })}`}</p>
        </>
      )}

      <h2 className={styles.overline}>Orders</h2>
      <Input
        label="Minimum order (optional)"
        value={minOrder}
        onChange={(e) => setMinOrder(rupeeInput(e.target.value))}
        prefix="₹"
        inputMode="decimal"
        placeholder="0"
        hint="Carts below this can't be ordered."
      />

      <h2 className={styles.overline}>Returns</h2>
      <div className={styles.switches}>
        <Switch
          checked={returns}
          onChange={setReturns}
          description={
            returns
              ? `Customers can ask to return within ${setup.returnDays} day${setup.returnDays === 1 ? "" : "s"} of delivery. You pay the trip back if you sent the wrong item or it was damaged; otherwise the customer does.`
              : "Your shop shows “No returns”."
          }
        >
          Take returns
        </Switch>
      </div>
      {releaseHours !== null && (
        <p className={styles.faint}>{`You’re paid for an order once its return window is over, and at least ${releaseHours} hours after delivery.`}</p>
      )}

      <TextArea label="Notes for customers (optional)" value={notes} onChange={setNotes} placeholder="Shop timings, sizes that run small, how you pack…" max={NOTES_MAX} />

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

/** A local shop's setup: delivery or pickup, how far and for how much, the smallest order, and whether it takes returns. */
export function StoreSetupScreen({ id }: { id: string }) {
  const setup = useLoad(() => storeSetup(id), id);
  const catalog = useLoad(() => vendorCatalog());
  const rules = useLoad(() => storeRules());
  const error = setup.error ?? catalog.error;
  if (error && !(setup.data && catalog.data)) {
    return (
      <Failed
        error={error}
        onRetry={() => {
          if (setup.error) setup.reload();
          if (catalog.error) catalog.reload();
        }}
      />
    );
  }
  if (!setup.data || !catalog.data) return <Loading rows={6} />;
  return (
    <div className={styles.page}>
      <Back href={`/vendor/businesses/${id}`}>Business</Back>
      <h1 className={styles.title}>Delivery & returns</h1>
      <Form id={id} setup={setup.data} catalog={catalog.data} releaseHours={rules.data?.releaseHours ?? null} />
    </div>
  );
}
