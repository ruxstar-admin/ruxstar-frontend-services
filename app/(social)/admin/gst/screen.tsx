"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { Needs, useCan } from "@/components/admin/AdminFrame";
import { Failed, Fact, Rows, styles } from "@/components/admin/parts";
import { useOnSignedOut } from "@/components/social/session";
import { Button, Card, Input, Segmented, Switch, Tag, useToast } from "@/components/ui";
import { formError } from "@/lib/api/account";
import { getBusinessCatalog } from "@/lib/api/admin";
import {
  gstSettings,
  updateGstModule,
  updateGstSeller,
  type GstModule,
  type GstModulePatch,
  type GstModuleSettings,
  type GstSeller,
  type GstSellerPatch,
} from "@/lib/api/invoices";
import { money } from "@/lib/api/shops";
import { percent } from "@/lib/invoices";
import { ago } from "@/lib/time";
import invoices from "@/components/invoices/invoices.module.css";
import { GST_MODULE_LABEL as MODULE_LABEL } from "../modules/labels";

/** Settings are ready for these, but their orders don't exist yet, so nothing is issued. */
const NOT_INVOICING: readonly GstModule[] = ["coaching", "stays", "turf", "ecommerce"];

/** The first two digits of a GSTIN; the API checks the address is in the same state. */
const GST_STATE_CODE: Record<string, string> = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
};
const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const GSTIN_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const CODE = /^([0-9]{4,8})?$/;
const PINCODE = /^[1-9][0-9]{5}$/;
const MAX_GST_BPS = 4000;
const MAX_TCS_BPS = 200;
const CODE_KINDS = [
  { value: "hsn", label: "HSN (goods)" },
  { value: "sac", label: "SAC (services)" },
] as const;

/** "18" or "0.5" → basis points; NaN unless it's a number with at most 2 decimals. */
const bpsOf = (text: string) => (/^\d{1,3}(\.\d{1,2})?$/.test(text.trim()) ? Math.round(Number(text) * 100) : NaN);
const percentText = (bps: number) => String(bps / 100);
const decimal = (set: (v: string) => void) => (value: string) => set(value.replace(/[^\d.]/g, ""));
const lowRateText = (low: GstModuleSettings["lowRate"]) => (low ? `${percent(low.rateBps)} up to ${money(low.upTo)} a piece, tax included` : "None");

/** The 15th character: a base-36 checksum of the first 14. */
function gstinCheckChar(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const product = GSTIN_CHARS.indexOf(first14[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return GSTIN_CHARS[(36 - (sum % 36)) % 36];
}

/** Why a GSTIN can't be right, or undefined when it looks right. Same messages as the app. */
function gstinError(gstin: string): string | undefined {
  if (gstin.length !== 15) return "A GSTIN has 15 characters: 2 digits, the 10-character PAN, then 3 more.";
  if (!GSTIN.test(gstin)) return "That isn't a GSTIN's shape: 2 digits, the 10-character PAN, a number or letter, Z, then one more.";
  if (!GST_STATE_CODE[gstin.slice(0, 2)]) return "The first two digits should be a state code, like 36 for Telangana.";
  if (gstinCheckChar(gstin.slice(0, 14)) !== gstin[14]) return "The last character doesn't match the rest. Check for a typo.";
  return undefined;
}

type SellerField = "legalName" | "tradeName" | "gstin" | "line" | "city" | "state" | "pincode" | "feeCode" | "feeRate";
type SellerText = Record<SellerField, string>;

const sellerText = (s: GstSeller): SellerText => ({
  legalName: s.legalName,
  tradeName: s.tradeName,
  gstin: s.gstin ?? "",
  line: s.address?.line ?? "",
  city: s.address?.city ?? "",
  state: s.address?.state ?? "",
  pincode: s.address?.pincode ?? "",
  feeCode: s.feeCode,
  feeRate: percentText(s.feeRateBps),
});

function checkSeller(t: SellerText): Partial<Record<SellerField, string>> {
  const errors: Partial<Record<SellerField, string>> = {};
  const length = (field: SellerField, min: number, max: number, what: string) => {
    const n = t[field].trim().length;
    if (n < min || n > max) errors[field] = `${what} needs ${min} to ${max} characters.`;
  };
  length("legalName", 2, 120, "The legal name");
  length("tradeName", 2, 120, "The trade name");
  const gstin = t.gstin.trim();
  const gstinProblem = gstin ? gstinError(gstin) : undefined;
  if (gstinProblem) errors.gstin = gstinProblem;
  const anyAddress = [t.line, t.city, t.state, t.pincode].some((v) => v.trim());
  if (anyAddress) {
    length("line", 3, 200, "The address");
    length("city", 2, 60, "The city");
    if (!t.state) errors.state = "Pick a state.";
    if (!PINCODE.test(t.pincode.trim())) errors.pincode = "A PIN code has 6 digits and doesn't start with 0.";
  }
  const registered = gstin && GSTIN.test(gstin) ? GST_STATE_CODE[gstin.slice(0, 2)] : undefined;
  if (registered && t.state && registered !== t.state) errors.state = `The GSTIN is registered in ${registered}, so the address must be in ${registered}.`;
  if (!CODE.test(t.feeCode.trim())) errors.feeCode = "Use 4 to 8 digits, like 998599.";
  const fee = bpsOf(t.feeRate);
  if (!(fee >= 0 && fee <= MAX_GST_BPS)) errors.feeRate = "Enter a rate from 0 to 40.";
  return errors;
}

function sellerPatch(before: GstSeller, t: SellerText): GstSellerPatch {
  const patch: GstSellerPatch = {};
  if (t.legalName.trim() !== before.legalName) patch.legalName = t.legalName.trim();
  if (t.tradeName.trim() !== before.tradeName) patch.tradeName = t.tradeName.trim();
  const gstin = t.gstin.trim() || null;
  if (gstin !== before.gstin) patch.gstin = gstin;
  const address = [t.line, t.city, t.state, t.pincode].some((v) => v.trim())
    ? { line: t.line.trim(), city: t.city.trim(), state: t.state, pincode: t.pincode.trim() }
    : null;
  if (JSON.stringify(address) !== JSON.stringify(before.address)) patch.address = address;
  if (t.feeCode.trim() !== before.feeCode) patch.feeCode = t.feeCode.trim();
  const feeRateBps = bpsOf(t.feeRate);
  if (feeRateBps !== before.feeRateBps) patch.feeRateBps = feeRateBps;
  return patch;
}

/** Maps the API's "body/address/state" to the field it's about. */
const FIELD_OF: Record<string, SellerField> = {
  legalName: "legalName",
  tradeName: "tradeName",
  gstin: "gstin",
  "address/line": "line",
  "address/city": "city",
  "address/state": "state",
  "address/pincode": "pincode",
  feeCode: "feeCode",
  feeRateBps: "feeRate",
};

function StateSelect({ value, states, onChange, error, disabled }: { value: string; states: string[]; onChange: (v: string) => void; error?: string; disabled: boolean }) {
  const id = useId();
  return (
    <div className={invoices.field}>
      <label htmlFor={id} className={invoices.label}>
        State
      </label>
      <select
        id={id}
        className={invoices.select}
        value={value}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Pick a state</option>
        {(states.includes(value) || !value ? states : [value, ...states]).map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${id}-error`} className={invoices.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Ruxstar's own GST details: on its platform-fee documents, and as the e-commerce operator on businesses' documents. */
function SellerForm({ seller, states, onSaved }: { seller: GstSeller; states: string[]; onSaved: (s: GstSeller) => void }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const canManage = useCan("modules.manage");
  const [text, setText] = useState(() => sellerText(seller));
  const [shown, setShown] = useState<Partial<Record<SellerField, string>>>({});
  const [busy, setBusy] = useState(false);

  const set = (field: SellerField) => (value: string) => {
    setText((t) => ({ ...t, [field]: value }));
    setShown((e) => ({ ...e, [field]: undefined }));
  };
  const patch = sellerPatch(seller, text);
  const changed = Object.keys(patch).length > 0;
  const gstin = text.gstin.trim();
  const registered = GSTIN.test(gstin) ? GST_STATE_CODE[gstin.slice(0, 2)] : undefined;

  async function save() {
    const found = checkSeller(text);
    setShown(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      const done = await updateGstSeller(patch);
      onSaved(done);
      setText(sellerText(done));
      toast("Ruxstar's GST details saved.", "success");
    } catch (err) {
      if (onSignedOut(err)) return;
      const { message, field } = formError(err);
      const at = field ? FIELD_OF[field] : undefined;
      if (at) setShown({ [at]: message });
      else toast(message, "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card as="section" padding="lg" className={styles.page} aria-labelledby="gst-seller">
      <div className={styles.groupHead}>
        <div>
          <h2 id="gst-seller" className={styles.subtitle}>
            Ruxstar&apos;s GST details
          </h2>
          <p className={styles.muted}>
            On Ruxstar&apos;s platform-fee documents, and as the e-commerce operator on every business&apos;s documents.
            {seller.updatedAt ? ` Changed ${ago(seller.updatedAt)}.` : ""}
          </p>
        </div>
        <Tag tone={seller.gstin ? "success" : "warning"}>{seller.gstin ? "GST registered" : "No GSTIN yet"}</Tag>
      </div>
      {!seller.gstin && (
        <p className={styles.note} data-tone="danger">
          Without a GSTIN, Ruxstar&apos;s platform-fee documents are bills of supply with no GST. Enter the GSTIN, legal name and registered address before going live.
        </p>
      )}
      <form
        className={styles.page}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className={styles.toolbar}>
          <Input label="Legal name" value={text.legalName} onChange={(e) => set("legalName")(e.target.value)} maxLength={120} disabled={!canManage} error={shown.legalName} />
          <Input label="Trade name" value={text.tradeName} onChange={(e) => set("tradeName")(e.target.value)} maxLength={120} disabled={!canManage} error={shown.tradeName} />
        </div>
        <Input
          label="GSTIN"
          value={text.gstin}
          onChange={(e) => set("gstin")(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 15))}
          placeholder="29ABCDE1234F1Z5"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          maxLength={15}
          disabled={!canManage}
          hint={registered ? `Registered in ${registered}.` : "15 characters. Leave it empty while Ruxstar isn't registered."}
          error={shown.gstin}
        />
        <Input label="Registered address" value={text.line} onChange={(e) => set("line")(e.target.value)} maxLength={200} disabled={!canManage} error={shown.line} />
        <div className={styles.toolbar}>
          <Input label="City" value={text.city} onChange={(e) => set("city")(e.target.value)} maxLength={60} disabled={!canManage} error={shown.city} />
          <StateSelect value={text.state} states={states} onChange={set("state")} error={shown.state} disabled={!canManage} />
          <Input
            label="PIN code"
            inputMode="numeric"
            value={text.pincode}
            onChange={(e) => set("pincode")(e.target.value.replace(/\D/g, "").slice(0, 6))}
            maxLength={6}
            disabled={!canManage}
            error={shown.pincode}
          />
        </div>
        <div className={styles.toolbar}>
          <Input
            label="Platform fee SAC"
            inputMode="numeric"
            value={text.feeCode}
            onChange={(e) => set("feeCode")(e.target.value.replace(/\D/g, "").slice(0, 8))}
            maxLength={8}
            disabled={!canManage}
            error={shown.feeCode}
          />
          <Input
            label="GST on the platform fee"
            inputMode="decimal"
            suffix="%"
            value={text.feeRate}
            onChange={(e) => decimal(set("feeRate"))(e.target.value)}
            disabled={!canManage}
            error={shown.feeRate}
          />
        </div>
        {canManage && (
          <div className={styles.actions}>
            <Button type="submit" variant="secondary" disabled={!changed} loading={busy}>
              Save Ruxstar&apos;s details
            </Button>
          </div>
        )}
      </form>
    </Card>
  );
}

function ItemRates({ items }: { items: GstModuleSettings["items"] }) {
  if (!items.length) return null;
  return (
    <div className={invoices.tableWrap} role="region" aria-label="Rates for products and kinds" tabIndex={0}>
      <table className={invoices.table}>
        <caption className="sr-only">Rates for products and kinds; the rest use the module&apos;s rate</caption>
        <thead>
          <tr>
            <th scope="col">Product or kind</th>
            <th scope="col">Code</th>
            <th scope="col" className={invoices.num}>
              GST
            </th>
            <th scope="col">Lower rate</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.key}>
              <th scope="row">{i.label}</th>
              <td>{i.code ? `${i.codeKind.toUpperCase()} ${i.code}` : "—"}</td>
              <td className={invoices.num}>{percent(i.rateBps)}</td>
              <td>{lowRateText(i.lowRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** One module's GST rules. Prices always include GST: the API refuses the other setting because it would change what customers pay. */
function ModuleRules({ m, onSaved }: { m: GstModuleSettings; onSaved: (m: GstModuleSettings) => void }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const canManage = useCan("modules.manage");
  const [rate, setRate] = useState(percentText(m.rateBps));
  const [tcs, setTcs] = useState(percentText(m.tcsBps));
  const [code, setCode] = useState(m.code);
  const [codeKind, setCodeKind] = useState(m.codeKind);
  const [busy, setBusy] = useState<"enabled" | "rules" | null>(null);
  const [turningOff, setTurningOff] = useState(false);
  const label = MODULE_LABEL[m.module];

  const rateBps = bpsOf(rate);
  const tcsBps = bpsOf(tcs);
  const errors = {
    rate: rateBps >= 0 && rateBps <= MAX_GST_BPS ? undefined : "Enter a rate from 0 to 40",
    tcs: tcsBps >= 0 && tcsBps <= MAX_TCS_BPS ? undefined : "Enter a rate from 0 to 2",
    code: CODE.test(code) ? undefined : "Use 4 to 8 digits",
  };
  const rules: GstModulePatch = {
    ...(rateBps !== m.rateBps ? { rateBps } : {}),
    ...(tcsBps !== m.tcsBps ? { tcsBps } : {}),
    ...(code !== m.code ? { code } : {}),
    ...(codeKind !== m.codeKind ? { codeKind } : {}),
  };
  const invalid = Object.values(errors).some(Boolean);
  const changed = Object.keys(rules).length > 0;
  const locked = !canManage || busy !== null;

  async function save(patch: GstModulePatch, what: "enabled" | "rules") {
    setBusy(what);
    try {
      const done = await updateGstModule(m.module, patch);
      onSaved(done);
      setRate(percentText(done.rateBps));
      setTcs(percentText(done.tcsBps));
      setCode(done.code);
      setCodeKind(done.codeKind);
      setTurningOff(false);
      toast(`${label} GST saved.`, "success");
    } catch (err) {
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card as="section" padding="lg" className={styles.page} aria-labelledby={`gst-${m.module}`}>
      <div className={styles.groupHead}>
        <div>
          <h2 id={`gst-${m.module}`} className={styles.subtitle}>
            {label}
          </h2>
          <p className={styles.muted}>
            {m.updatedAt ? `Changed ${ago(m.updatedAt)}` : "On the defaults"}
            {NOT_INVOICING.includes(m.module) ? ". Nothing is issued yet: its orders aren't on Ruxstar." : ""}
          </p>
        </div>
        <Tag tone={m.enabled ? "success" : "neutral"}>{m.enabled ? "Issuing" : "Off"}</Tag>
      </div>
      <div className={styles.group}>
        <Switch
          checked={m.enabled}
          onChange={(enabled) => (enabled ? void save({ enabled }, "enabled") : setTurningOff(true))}
          disabled={locked || turningOff}
          description="Invoices, bills of supply and credit notes for this module's paid orders, including Ruxstar's fee invoice."
        >
          Issue GST documents
        </Switch>
        {turningOff && (
          <div className={styles.note}>
            <span className={styles.whoRow}>
              <strong>{`Stop GST documents for ${label}?`}</strong>
              <span className={styles.muted}>Orders paid from now on get no invoice, not even Ruxstar&apos;s fee invoice. Documents already issued stay as they are.</span>
            </span>
            <div className={styles.actions}>
              <Button variant="ghost" disabled={busy === "enabled"} onClick={() => setTurningOff(false)}>
                Cancel
              </Button>
              <Button variant="danger" loading={busy === "enabled"} onClick={() => void save({ enabled: false }, "enabled")}>
                Turn off
              </Button>
            </div>
          </div>
        )}
      </div>
      <div className={styles.toolbar}>
        <Input
          label="GST rate"
          inputMode="decimal"
          suffix="%"
          value={rate}
          onChange={(e) => decimal(setRate)(e.target.value)}
          disabled={!canManage}
          hint="The standard rate for this module. Items listed below keep their own rates."
          error={errors.rate}
        />
        <Input
          label="TCS"
          inputMode="decimal"
          suffix="%"
          value={tcs}
          onChange={(e) => decimal(setTcs)(e.target.value)}
          disabled={!canManage}
          hint={`Tax Ruxstar collects at source on GST-registered businesses' sales; 0.5% since 10 July 2024. Up to ${percent(MAX_TCS_BPS)}. Shown on their invoices; not taken from payouts yet.`}
          error={errors.tcs}
        />
      </div>
      <div className={styles.toolbar}>
        <Input
          label={codeKind === "hsn" ? "HSN code" : "SAC code"}
          inputMode="numeric"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
          maxLength={8}
          disabled={!canManage}
          hint="Printed on every line. SAC is for services, HSN for goods: 4 to 8 digits. Leave empty if there isn't one yet."
          error={errors.code}
        />
        {canManage ? (
          <Segmented label="Code type" options={CODE_KINDS} value={codeKind} onChange={setCodeKind} />
        ) : (
          <span className={styles.muted}>{CODE_KINDS.find((k) => k.value === codeKind)?.label}</span>
        )}
      </div>
      {canManage && (
        <div className={styles.actions}>
          <Button variant="secondary" disabled={invalid || !changed || (busy !== null && busy !== "rules")} loading={busy === "rules"} onClick={() => void save(rules, "rules")}>
            Save rates
          </Button>
        </div>
      )}
      <dl className={styles.facts}>
        <Fact label="Prices include GST" value={m.pricesIncludeTax ? "Yes, always" : "No"} />
        <Fact label="Who sells" value={m.seller === "vendor" ? "The business, with Ruxstar as the e-commerce operator" : "Ruxstar invoices the sale itself"} />
        <Fact
          label="A business without a GSTIN"
          value={m.withoutGstin === "bill_of_supply" ? "Issues a bill of supply, with no GST" : "Ruxstar invoices it and pays the GST (section 9(5))"}
        />
        <Fact label="Lower rate" value={lowRateText(m.lowRate)} />
      </dl>
      <p className={styles.note}>
        Customers always pay the price they see, and the invoice shows how much of it was GST. Adding GST on top of prices at checkout isn&apos;t available yet, because it would change what
        customers pay, so Ruxstar refuses switching this off.
      </p>
      <ItemRates items={m.items} />
    </Card>
  );
}

/** Ruxstar's own GST details and each module's GST rules. Opened from a module's page (`module`), only that module's rules. Same as the app. */
export function GstScreen({ module }: { module?: GstModule }) {
  const onSignedOut = useOnSignedOut();
  const canManage = useCan("modules.manage");
  const canSeeInvoices = useCan("orders.view");
  const [seller, setSeller] = useState<GstSeller | null>(null);
  const [modules, setModules] = useState<GstModuleSettings[] | null>(null);
  const [states, setStates] = useState<string[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    gstSettings().then(
      (s) => {
        if (!live) return;
        setSeller(s.seller);
        setModules(s.modules);
      },
      (err) => live && !onSignedOut(err) && setError(err),
    );
    if (!module) {
      getBusinessCatalog().then(
        (c) => live && setStates(c.states.map((s) => s.name)),
        () => live && setStates(Object.values(GST_STATE_CODE).sort()),
      );
    }
    return () => {
      live = false;
    };
  }, [module, attempt, onSignedOut]);

  return (
    <Needs need="modules.view">
      <div className={styles.page}>
        <div className={styles.head}>
          <div>
            <h1 className={styles.title}>{module ? `GST · ${MODULE_LABEL[module]}` : "GST"}</h1>
            <p className={styles.muted}>
              {canManage
                ? "Changes apply to orders paid from now on; documents already issued never change. Every change is written to the audit log."
                : "You can see these settings. Ask an admin to change them."}
            </p>
          </div>
          <span className={styles.tags}>
            {module && (
              <Link href="/admin/gst" className={styles.muted}>
                All of GST
              </Link>
            )}
            {canSeeInvoices && (
              <Link href="/admin/invoices" className={styles.muted}>
                Every invoice
              </Link>
            )}
          </span>
        </div>
        {error ? (
          <Failed
            error={error}
            onRetry={() => {
              setError(null);
              setAttempt((n) => n + 1);
            }}
          />
        ) : !seller || !modules ? (
          <Rows count={3} height={260} />
        ) : (
          <>
            {!module && <SellerForm seller={seller} states={states} onSaved={setSeller} />}
            {modules.filter((m) => !module || m.module === module).map((m) => (
              <ModuleRules key={m.module} m={m} onSaved={(done) => setModules((list) => list?.map((x) => (x.module === done.module ? done : x)) ?? null)} />
            ))}
          </>
        )}
      </div>
    </Needs>
  );
}
