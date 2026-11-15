"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Button, Icon } from "@/components/ui";
import { useOnSignedOut } from "@/components/social/session";
import { usePages } from "@/components/social/use-pages";
import { SkeletonRows } from "@/app/(social)/notifications/screen";
import { InvoiceTable } from "@/components/invoices/InvoiceTable";
import { formError } from "@/lib/api/account";
import { exportVendorInvoices, vendorInvoices, type InvoiceKind, type VendorInvoiceFilter } from "@/lib/api/invoices";
import { myBusinesses, type Business } from "@/lib/api/vendor";
import vendor from "@/components/vendor/vendor.module.css";
import styles from "@/components/invoices/invoices.module.css";

const KINDS: { value: InvoiceKind | ""; label: string }[] = [
  { value: "", label: "Every type" },
  { value: "tax_invoice", label: "Tax invoices" },
  { value: "bill_of_supply", label: "Bills of supply" },
  { value: "credit_note", label: "Credit notes" },
];
type InvoiceModule = NonNullable<VendorInvoiceFilter["module"]>;
const MODULE_LABEL: Partial<Record<InvoiceModule, string>> = { pod: "Print", events: "Events", coaching: "Coaching" };
const MONTHS_BACK = 24;

/** Today as YYYY-MM-DD in India time, the time the documents and the CSV use. */
const todayInIndia = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const monthName = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const monthLabel = (month: string) => monthName.format(new Date(`${month}-15T12:00:00+05:30`));
const two = (n: number) => String(n).padStart(2, "0");

function recentMonths(): string[] {
  const [year, month] = todayInIndia().split("-").map(Number) as [number, number];
  return Array.from({ length: MONTHS_BACK }, (_, i) => {
    const index = year * 12 + (month - 1) - i;
    return `${Math.floor(index / 12)}-${two((index % 12) + 1)}`;
  });
}

/** The month's first and last day; the API reads a plain day as the whole day in India. */
function monthBounds(month: string) {
  const [year, m] = month.split("-").map(Number) as [number, number];
  const lastDay = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${two(lastDay)}` };
}

/** April to today: GST's financial year, and inside the export's one-year limit. */
function financialYearSoFar() {
  const to = todayInIndia();
  const [year, month] = to.split("-").map(Number) as [number, number];
  const first = month >= 4 ? year : year - 1;
  return { from: `${first}-04-01`, to, label: `${first}-${two((first + 1) % 100)} so far` };
}

function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly { value: T; label: string }[]; onChange: (value: T) => void }) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <select id={id} className={styles.select} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function List({ filter, month, showBusiness }: { filter: VendorInvoiceFilter; month: string; showBusiness: boolean }) {
  const onSignedOut = useOnSignedOut();
  const load = useCallback((cursor?: string) => vendorInvoices(filter, cursor), [filter]);
  const { items, loading, loadingMore, hasMore, error, more, reload } = usePages(load);

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  if (loading) return <SkeletonRows count={3} />;
  if (error && items.length === 0) {
    return (
      <div className={vendor.card}>
        <p className={vendor.error} role="alert">
          {formError(error).message}
        </p>
        <div>
          <Button variant="secondary" onClick={reload}>
            Try again
          </Button>
        </div>
      </div>
    );
  }
  const filtered = !!(month || filter.kind || filter.business || filter.module);
  if (items.length === 0) {
    return (
      <div className={vendor.card}>
        <strong>{filtered ? "Nothing matches" : "No GST documents yet"}</strong>
        <p className={vendor.muted}>
          {filtered ? "Try another month or type." : "Ruxstar issues a GST invoice in your business's name for every paid order, and a credit note for every refund."}
        </p>
      </div>
    );
  }
  return (
    <>
      <InvoiceTable items={items} audience="vendor" caption={month ? `Documents from ${monthLabel(month)}` : "Your documents, newest first"} showBusiness={showBusiness} />
      {error && (
        <p className={vendor.error} role="alert">
          {formError(error).message}
        </p>
      )}
      {hasMore && (
        <div className={styles.more}>
          <Button variant="secondary" loading={loadingMore} onClick={more}>
            Show more
          </Button>
        </div>
      )}
    </>
  );
}

/** Every GST document issued in the vendor's businesses' names, by month and type, with the CSV for GST returns. Same as the app. */
export function VendorInvoicesScreen() {
  const onSignedOut = useOnSignedOut();
  const months = useMemo(recentMonths, []);
  const [month, setMonth] = useState("");
  const [kind, setKind] = useState<InvoiceKind | "">("");
  const [business, setBusiness] = useState("");
  const [module, setModule] = useState<InvoiceModule | "">("");
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    myBusinesses().then(
      (list) => live && setBusinesses(list),
      (err: unknown) => live && onSignedOut(err),
    );
    return () => {
      live = false;
    };
  }, [onSignedOut]);

  const filter = useMemo<VendorInvoiceFilter>(
    () => ({ ...(kind ? { kind } : {}), ...(business ? { business } : {}), ...(module ? { module } : {}), ...(month ? monthBounds(month) : {}) }),
    [kind, business, module, month],
  );
  const period = month ? { ...monthBounds(month), label: monthLabel(month) } : financialYearSoFar();
  const modules = (Object.keys(MODULE_LABEL) as InvoiceModule[]).filter((m) => businesses.some((b) => b.module === m));

  const exportCsv = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const csv = await exportVendorInvoices({ from: period.from, to: period.to, ...(business ? { business } : {}) });
      saveFile(csv, `ruxstar-gst-${period.from}-to-${period.to}.csv`);
    } catch (err) {
      if (!onSignedOut(err)) setExportError(formError(err).message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className={vendor.page}>
      <div className={vendor.head}>
        <div>
          <h1 className={vendor.title}>GST invoices</h1>
          <p className={vendor.muted}>Tax invoices, bills of supply and credit notes Ruxstar issued in your business&apos;s name. Ruxstar&apos;s own fee invoices aren&apos;t here.</p>
        </div>
      </div>
      <div className={styles.filters}>
        <Choice label="Month" value={month} onChange={setMonth} options={[{ value: "", label: "Any month" }, ...months.map((m) => ({ value: m, label: monthLabel(m) }))]} />
        <Choice label="Type" value={kind} onChange={setKind} options={KINDS} />
        {modules.length > 1 && (
          <Choice
            label="Kind"
            value={module}
            onChange={(next) => {
              setModule(next);
              setBusiness("");
            }}
            options={[{ value: "", label: "Every kind" }, ...modules.map((m) => ({ value: m, label: MODULE_LABEL[m]! }))]}
          />
        )}
        {businesses.length > 1 && (
          <Choice
            label="Business"
            value={business}
            onChange={setBusiness}
            options={[{ value: "", label: "Every business" }, ...businesses.filter((b) => !module || b.module === module).map((b) => ({ value: b.id, label: b.name }))]}
          />
        )}
        <Button variant="secondary" icon={<Icon name="download" size={18} />} loading={exporting} onClick={() => void exportCsv()}>
          {`Export ${period.label} as CSV`}
        </Button>
      </div>
      <p className={vendor.faint}>For your GST return: every invoice, bill of supply and credit note in that period, one row per item, amounts in rupees.</p>
      {exportError && (
        <p className={vendor.error} role="alert">
          {exportError}
        </p>
      )}
      <List key={`${month}|${kind}|${business}|${module}`} filter={filter} month={month} showBusiness={businesses.length > 1} />
    </div>
  );
}
