"use client";

import { useEffect, useState } from "react";
import { Needs, useCan } from "@/components/admin/AdminFrame";
import { Failed, Rows, styles } from "@/components/admin/parts";
import { useOnSignedOut } from "@/components/social/session";
import { Button, Card, Input, Switch, Tag, useToast } from "@/components/ui";
import { formError } from "@/lib/api/account";
import { listModules, updateModule, type ModulePatch, type ModuleSettings } from "@/lib/api/admin";
import { ago } from "@/lib/time";
import { MODULE_LABEL } from "./labels";

const percentOf = (bps: number) => String(bps / 100);
const rupeesOf = (paise: number) => String(paise / 100);
const MAX_FEE_RUPEES = 500;
const MAX_PAYOUT_FEE_RUPEES = 100;
const MAX_MIN_PAYOUT_RUPEES = 100_000;
const paiseOf = (rupees: string) => (rupees.trim() === "" ? NaN : Math.round(Number(rupees) * 100));

/** Ledger only: the fee taken from each vendor withdrawal and the least they can withdraw. Same as the app. */
function Withdrawals({ m, payouts, onSaved }: { m: ModuleSettings; payouts: NonNullable<ModuleSettings["payouts"]>; onSaved: (m: ModuleSettings) => void }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const canManage = useCan("modules.manage");
  const [fee, setFee] = useState(rupeesOf(payouts.fee));
  const [minimum, setMinimum] = useState(rupeesOf(payouts.minimum));
  const [busy, setBusy] = useState(false);

  const feePaise = paiseOf(fee);
  const minPaise = paiseOf(minimum);
  const feeError = Number.isFinite(feePaise) && feePaise >= 0 && feePaise <= MAX_PAYOUT_FEE_RUPEES * 100 ? undefined : `Enter an amount from 0 to ${MAX_PAYOUT_FEE_RUPEES}`;
  const minError =
    !Number.isFinite(minPaise) || minPaise < 100 || minPaise > MAX_MIN_PAYOUT_RUPEES * 100
      ? `Enter an amount from 1 to ${MAX_MIN_PAYOUT_RUPEES.toLocaleString("en-IN")}`
      : !feeError && minPaise < feePaise + 100
        ? "At least ₹1 more than the fee"
        : undefined;
  const changed = feePaise !== payouts.fee || minPaise !== payouts.minimum;

  async function save() {
    setBusy(true);
    try {
      const done = await updateModule(m.module, { payoutFee: feePaise, minPayout: minPaise });
      onSaved(done);
      if (done.payouts) {
        setFee(rupeesOf(done.payouts.fee));
        setMinimum(rupeesOf(done.payouts.minimum));
      }
      toast("Withdrawal settings saved.", "success");
    } catch (err) {
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.toolbar}>
      <Input
        label="Fee taken from each withdrawal"
        inputMode="decimal"
        prefix="₹"
        value={fee}
        onChange={(e) => setFee(e.target.value.replace(/[^\d.]/g, ""))}
        disabled={!canManage}
        hint="Covers Cashfree's charge. The vendor gets the rest. 0 for none."
        error={feeError}
      />
      <Input
        label="Least a vendor can withdraw"
        inputMode="decimal"
        prefix="₹"
        value={minimum}
        onChange={(e) => setMinimum(e.target.value.replace(/[^\d.]/g, ""))}
        disabled={!canManage}
        error={minError}
      />
      {canManage && (
        <Button variant="secondary" disabled={!!feeError || !!minError || !changed} loading={busy} onClick={() => void save()}>
          Save withdrawal settings
        </Button>
      )}
    </div>
  );
}

const MAX_RATE_RUPEES = 1000;
const wholeOf = (text: string) => (/^\d+$/.test(text.trim()) ? Number(text) : NaN);
const rupeeError = (paise: number) => (Number.isFinite(paise) && paise >= 0 && paise <= MAX_RATE_RUPEES * 100 ? undefined : `Enter an amount from 0 to ${MAX_RATE_RUPEES}`);
const rupees = (set: (v: string) => void) => (value: string) => set(value.replace(/[^\d.]/g, ""));
const whole = (set: (v: string) => void) => (value: string) => set(value.replace(/\D/g, ""));

/** Delivery only: what a Ruxstar partner is paid for a trip, the most a shop can charge, and how long an offer waits. Same as the app. */
function DeliveryRates({ m, delivery: d, onSaved }: { m: ModuleSettings; delivery: NonNullable<ModuleSettings["delivery"]>; onSaved: (m: ModuleSettings) => void }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const canManage = useCan("modules.manage");
  const [riderBase, setRiderBase] = useState(rupeesOf(d.riderRate.base));
  const [riderKm, setRiderKm] = useState(String(d.riderRate.includedKm));
  const [riderPerKm, setRiderPerKm] = useState(rupeesOf(d.riderRate.perKm));
  const [shopBase, setShopBase] = useState(rupeesOf(d.shopFeeMax.base));
  const [shopPerKm, setShopPerKm] = useState(rupeesOf(d.shopFeeMax.perKm));
  const [minutes, setMinutes] = useState(String(d.offerMinutes));
  const [busy, setBusy] = useState(false);

  const riderRate = { base: paiseOf(riderBase), includedKm: wholeOf(riderKm), perKm: paiseOf(riderPerKm) };
  const shopFeeMax = { base: paiseOf(shopBase), perKm: paiseOf(shopPerKm) };
  const offerMinutes = wholeOf(minutes);
  const errors = {
    riderBase: rupeeError(riderRate.base),
    riderKm: riderRate.includedKm >= 0 && riderRate.includedKm <= 50 ? undefined : "Enter whole km from 0 to 50",
    riderPerKm: rupeeError(riderRate.perKm),
    shopBase: rupeeError(shopFeeMax.base),
    shopPerKm: rupeeError(shopFeeMax.perKm),
    minutes: offerMinutes >= 1 && offerMinutes <= 120 ? undefined : "Enter whole minutes from 1 to 120",
  };
  const invalid = Object.values(errors).some(Boolean);
  const changed =
    riderRate.base !== d.riderRate.base ||
    riderRate.includedKm !== d.riderRate.includedKm ||
    riderRate.perKm !== d.riderRate.perKm ||
    shopFeeMax.base !== d.shopFeeMax.base ||
    shopFeeMax.perKm !== d.shopFeeMax.perKm ||
    offerMinutes !== d.offerMinutes;

  async function save() {
    setBusy(true);
    try {
      onSaved(await updateModule(m.module, { riderRate, shopFeeMax, offerMinutes }));
      toast("Delivery rates saved.", "success");
    } catch (err) {
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={styles.group}>
        <h3 className={styles.label}>Ruxstar partner pay, per trip</h3>
        <p className={styles.muted}>Paid to the partner out of the shop&apos;s share. The partner keeps all of it.</p>
      </div>
      <div className={styles.toolbar}>
        <Input label="Base (₹)" inputMode="decimal" value={riderBase} onChange={(e) => rupees(setRiderBase)(e.target.value)} disabled={!canManage} error={errors.riderBase} />
        <Input label="Covers (km)" inputMode="numeric" value={riderKm} onChange={(e) => whole(setRiderKm)(e.target.value)} disabled={!canManage} error={errors.riderKm} />
        <Input label="Each km after (₹)" inputMode="decimal" value={riderPerKm} onChange={(e) => rupees(setRiderPerKm)(e.target.value)} disabled={!canManage} error={errors.riderPerKm} />
      </div>
      <h3 className={styles.label}>Most a shop can charge customers</h3>
      <div className={styles.toolbar}>
        <Input label="Base (₹)" inputMode="decimal" value={shopBase} onChange={(e) => rupees(setShopBase)(e.target.value)} disabled={!canManage} error={errors.shopBase} />
        <Input label="Per km (₹)" inputMode="decimal" value={shopPerKm} onChange={(e) => rupees(setShopPerKm)(e.target.value)} disabled={!canManage} error={errors.shopPerKm} />
      </div>
      <div className={styles.toolbar}>
        <Input
          label="Offer waits (minutes)"
          inputMode="numeric"
          value={minutes}
          onChange={(e) => whole(setMinutes)(e.target.value)}
          disabled={!canManage}
          hint="If no partner accepts by then, the offer is cancelled and the shop is told."
          error={errors.minutes}
        />
        {canManage && (
          <Button variant="secondary" disabled={invalid || !changed} loading={busy} onClick={() => void save()}>
            Save delivery rates
          </Button>
        )}
      </div>
    </>
  );
}

function Module({ m, onSaved }: { m: ModuleSettings; onSaved: (m: ModuleSettings) => void }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const canManage = useCan("modules.manage");
  const [busy, setBusy] = useState<keyof ModulePatch | null>(null);
  const [commission, setCommission] = useState(percentOf(m.commissionBps));
  const [fee, setFee] = useState(rupeesOf(m.platformFee));

  const bps = Math.round(Number(commission) * 100);
  const commissionValid = commission.trim() !== "" && Number.isFinite(bps) && bps >= 0 && bps <= 10000;
  const feePaise = Math.round(Number(fee) * 100);
  const feeValid = fee.trim() !== "" && Number.isFinite(feePaise) && feePaise >= 0 && feePaise <= MAX_FEE_RUPEES * 100;

  async function save(patch: ModulePatch) {
    setBusy(Object.keys(patch)[0] as keyof ModulePatch);
    try {
      const done = await updateModule(m.module, patch);
      onSaved(done);
      setCommission(percentOf(done.commissionBps));
      setFee(rupeesOf(done.platformFee));
      toast(`${MODULE_LABEL[m.module]} saved.`, "success");
    } catch (err) {
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setBusy(null);
    }
  }

  const locked = !canManage || busy !== null;

  return (
    <Card as="section" padding="lg" className={styles.page}>
      <div className={styles.groupHead}>
        <div>
          <h2 className={styles.subtitle}>{MODULE_LABEL[m.module]}</h2>
          <p className={styles.muted}>Changed {ago(m.updatedAt)}</p>
        </div>
        <Tag tone={m.live ? "success" : "neutral"}>{m.live ? "Live" : "Off"}</Tag>
      </div>
      <div className={styles.group}>
        <Switch checked={m.live} onChange={(live) => save({ live })} disabled={locked} description="Off hides it everywhere, for everyone.">
          Live
        </Switch>
        <Switch
          checked={m.signupsOpen}
          onChange={(signupsOpen) => save({ signupsOpen })}
          disabled={locked}
          description="Off keeps current vendors working but stops new ones joining."
        >
          New vendors can join
        </Switch>
        <Switch
          checked={m.deliveryEnabled}
          onChange={(deliveryEnabled) => save({ deliveryEnabled })}
          disabled={locked}
          description="Orders can be sent with a Ruxstar delivery partner."
        >
          Delivery
        </Switch>
        {m.gstinRequired !== null && (
          <Switch
            checked={m.gstinRequired}
            onChange={(gstinRequired) => save({ gstinRequired })}
            disabled={locked}
            description="New businesses need a verified GSTIN. Live ones without one stay live."
          >
            GSTIN needed to publish
          </Switch>
        )}
      </div>
      <div className={styles.toolbar}>
        <Input
          label="Commission on each order"
          inputMode="decimal"
          suffix="%"
          value={commission}
          onChange={(e) => setCommission(e.target.value.replace(/[^\d.]/g, ""))}
          disabled={!canManage}
          error={commissionValid ? undefined : "Enter a number from 0 to 100"}
        />
        {canManage && (
          <Button
            variant="secondary"
            disabled={!commissionValid || bps === m.commissionBps || (busy !== null && busy !== "commissionBps")}
            loading={busy === "commissionBps"}
            onClick={() => save({ commissionBps: bps })}
          >
            Save commission
          </Button>
        )}
      </div>
      <div className={styles.toolbar}>
        <Input
          label="Platform fee the customer pays on each order"
          inputMode="decimal"
          prefix="₹"
          value={fee}
          onChange={(e) => setFee(e.target.value.replace(/[^\d.]/g, ""))}
          disabled={!canManage}
          hint="Added to the customer's total and kept by Ruxstar. 0 for none."
          error={feeValid ? undefined : `Enter an amount from 0 to ${MAX_FEE_RUPEES}`}
        />
        {canManage && (
          <Button
            variant="secondary"
            disabled={!feeValid || feePaise === m.platformFee || (busy !== null && busy !== "platformFee")}
            loading={busy === "platformFee"}
            onClick={() => save({ platformFee: feePaise })}
          >
            Save platform fee
          </Button>
        )}
      </div>
      {m.payouts && <Withdrawals m={m} payouts={m.payouts} onSaved={onSaved} />}
      {m.delivery && <DeliveryRates m={m} delivery={m.delivery} onSaved={onSaved} />}
    </Card>
  );
}

export function ModulesScreen() {
  const onSignedOut = useOnSignedOut();
  const canManage = useCan("modules.manage");
  const [modules, setModules] = useState<ModuleSettings[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    listModules().then(
      (list) => live && setModules(list),
      (err) => live && !onSignedOut(err) && setError(err),
    );
    return () => {
      live = false;
    };
  }, [attempt, onSignedOut]);

  return (
    <Needs need="modules.view">
      <div className={styles.page}>
        <div>
          <h1 className={styles.title}>Modules</h1>
          <p className={styles.muted}>
            {canManage ? "Changes apply at once and are written to the audit log." : "You can see these settings. Ask an admin to change them."}
          </p>
        </div>
        {error ? (
          <Failed
            error={error}
            onRetry={() => {
              setError(null);
              setAttempt((n) => n + 1);
            }}
          />
        ) : !modules ? (
          <Rows count={3} height={260} />
        ) : (
          modules.map((m) => <Module key={m.module} m={m} onSaved={(done) => setModules((list) => list?.map((x) => (x.module === done.module ? done : x)) ?? null)} />)
        )}
      </div>
    </Needs>
  );
}
