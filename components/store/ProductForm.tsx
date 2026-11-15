"use client";

import { useRef, useState } from "react";
import { Button, Icon, Input, Switch } from "@/components/ui";
import { Select, TextArea } from "@/components/vendor/parts";
import { formError } from "@/lib/api/account";
import { ApiError } from "@/lib/api/client";
import type { ProductInput, ProductOption, StoreRules, VendorProduct, VariantInput } from "@/lib/api/store";
import { paiseOfText, rupeesOf, variantKey } from "@/lib/store";
import { shrinkPhoto } from "@/lib/photo";
import order from "@/components/shop/order.module.css";
import vendor from "@/components/vendor/vendor.module.css";
import styles from "./store.module.css";

const TITLE_MAX = 120;
const DESCRIPTION_MAX = 2000;
const NAME_MAX = 30;
const VALUE_MAX = 40;
const SKU_MAX = 40;
const MAX_PRICE = 1_00_000_00;
const MAX_STOCK = 100_000;
const PHOTO_SIDE = 1200;
const GST_RATES = ["Ruxstar’s rate", "0%", "5%", "12%", "18%", "28%"];

interface Row {
  on: boolean;
  price: string;
  mrp: string;
  stock: string;
  sku: string;
}
const EMPTY_ROW: Row = { on: true, price: "", mrp: "", stock: "", sku: "" };

const digits = (text: string, max = 6) => text.replace(/\D/g, "").slice(0, max);
const rupees = (text: string) => text.replace(/[^0-9.]/g, "").replace(/(\.\d{0,2}).*$/, "$1").slice(0, 9);

/** Every combination of the options' values, in order: Size × Colour gives S Red, S Blue, M Red… Without options, one empty row. */
function combos(options: ProductOption[]): string[][] {
  return options.reduce<string[][]>((acc, o) => acc.flatMap((head) => o.values.map((v) => [...head, v])), [[]]);
}

function rowsOf(product: VendorProduct | null): Map<string, Row> {
  const rows = new Map<string, Row>();
  for (const v of product?.variants ?? []) {
    rows.set(variantKey(v.values), { on: true, price: rupeesOf(v.price), mrp: v.mrp ? rupeesOf(v.mrp) : "", stock: String(v.stock), sku: v.sku ?? "" });
  }
  return rows;
}

function rowProblem(row: Row): string | null {
  const price = paiseOfText(row.price);
  if (price === null || price < 100) return "Price of at least ₹1";
  if (price > MAX_PRICE) return "Price up to ₹1,00,000";
  if (row.mrp.trim()) {
    const mrp = paiseOfText(row.mrp);
    if (mrp === null || mrp < price) return "MRP at least the price";
    if (mrp > MAX_PRICE) return "MRP up to ₹1,00,000";
  }
  if (!/^\d+$/.test(row.stock.trim()) || Number(row.stock) > MAX_STOCK) return "Stock as a number";
  return null;
}

/** An option such as Size with its values as removable chips, and a box to add more. */
function OptionEditor({
  option,
  index,
  maxValues,
  taken,
  onChange,
  onRemove,
}: {
  option: ProductOption;
  index: number;
  maxValues: number;
  taken: string[];
  onChange: (next: ProductOption) => void;
  onRemove: () => void;
}) {
  const [text, setText] = useState("");
  const add = () => {
    const parts = text
      .split(",")
      .map((v) => v.trim().slice(0, VALUE_MAX))
      .filter(Boolean);
    const values = [...option.values];
    for (const p of parts) if (!values.some((v) => v.toLowerCase() === p.toLowerCase()) && values.length < maxValues) values.push(p);
    onChange({ ...option, values });
    setText("");
  };
  const nameTaken = !!option.name.trim() && taken.some((t) => t.toLowerCase() === option.name.trim().toLowerCase());
  return (
    <div className={styles.optionRow}>
      <div className={vendor.inline}>
        <Input
          label={`Option ${index + 1}`}
          value={option.name}
          maxLength={NAME_MAX}
          placeholder={index === 0 ? "Size" : "Colour"}
          onChange={(e) => onChange({ ...option, name: e.target.value })}
          error={nameTaken ? "Each option needs its own name" : undefined}
        />
        <Button variant="ghost" icon={<Icon name="trash" size={16} />} onClick={onRemove}>
          Remove
        </Button>
      </div>
      {option.values.length > 0 && (
        <div className={styles.chips}>
          {option.values.map((v) => (
            <button
              key={v}
              type="button"
              className={styles.chip}
              aria-label={`Remove ${v}`}
              onClick={() => onChange({ ...option, values: option.values.filter((x) => x !== v) })}
            >
              {v}
              <Icon name="close" size={14} />
            </button>
          ))}
        </div>
      )}
      {option.values.length < maxValues ? (
        <div className={vendor.inline}>
          <Input
            label="Add values"
            value={text}
            placeholder={index === 0 ? "S, M, L" : "Red, Blue"}
            hint={`Separate with commas. Up to ${maxValues}.`}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              add();
            }}
          />
          <Button variant="secondary" disabled={!text.trim()} onClick={add}>
            Add
          </Button>
        </div>
      ) : (
        <p className={order.faint}>{`That’s the most values an option can have (${maxValues}).`}</p>
      )}
    </div>
  );
}

export interface ProductFormProps {
  product: VendorProduct | null;
  rules: StoreRules;
  /** The owner adds and removes the photo; the team can't. */
  canPhoto: boolean;
  /** Saves the words, options and table; for a new product, `photo` is uploaded after it's made. */
  onSave: (body: ProductInput, changedTable: boolean, photo: Blob | null) => Promise<void>;
  onPhoto?: (file: Blob | null) => Promise<void>;
  onDelete?: () => Promise<void>;
}

/**
 * A product and its variant table: up to two options (Size, Colour), each combination its own row with price, MRP, stock
 * and SKU, bulk-set across rows. Same fields as the app; one photo.
 */
export function ProductForm({ product, rules, canPhoto, onSave, onPhoto, onDelete }: ProductFormProps) {
  const [title, setTitle] = useState(product?.title ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [options, setOptions] = useState<ProductOption[]>(product?.options ?? []);
  const [rows, setRows] = useState<Map<string, Row>>(() => {
    const r = rowsOf(product);
    if (product) for (const values of combos(product.options)) if (!r.has(variantKey(values))) r.set(variantKey(values), { ...EMPTY_ROW, on: false });
    return r;
  });
  const [live, setLive] = useState(product ? product.status === "live" : true);
  const [hsn, setHsn] = useState(product?.hsn ?? "");
  const [gst, setGst] = useState(product?.gstRateBps === null || product?.gstRateBps === undefined ? GST_RATES[0]! : `${product.gstRateBps / 100}%`);
  const [bulk, setBulk] = useState({ price: "", mrp: "", stock: "" });
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [deleting, setDeleting] = useState<"ask" | "busy" | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const removed = product?.status === "removed";

  const usable = options.filter((o) => o.name.trim() && o.values.length);
  const table = combos(usable);
  const rowAt = (values: string[]) => rows.get(variantKey(values)) ?? EMPTY_ROW;
  const onRows = table.filter((v) => rowAt(v).on);
  const setRow = (values: string[], patch: Partial<Row>) =>
    setRows((now) => {
      const next = new Map(now);
      next.set(variantKey(values), { ...(now.get(variantKey(values)) ?? EMPTY_ROW), ...patch });
      return next;
    });
  const applyBulk = () => {
    setRows((now) => {
      const next = new Map(now);
      for (const values of table) {
        const k = variantKey(values);
        const row = now.get(k) ?? EMPTY_ROW;
        if (!row.on) continue;
        next.set(k, { ...row, ...(bulk.price ? { price: bulk.price } : {}), ...(bulk.mrp ? { mrp: bulk.mrp } : {}), ...(bulk.stock ? { stock: bulk.stock } : {}) });
      }
      return next;
    });
    setBulk({ price: "", mrp: "", stock: "" });
  };

  const names = options.map((o) => o.name.trim().toLowerCase());
  const optionProblem =
    options.some((o) => !o.name.trim() || !o.values.length) ? "Name each option and give it at least one value, or remove it." : new Set(names).size !== names.length ? "Each option needs its own name." : null;
  const tooMany = onRows.length > rules.maxVariants;
  const problems = onRows.map((v) => rowProblem(rowAt(v)));
  const titleProblem = title.trim().length < 2 ? "Give it a name of at least 2 letters" : null;
  const hsnProblem = hsn && !/^\d{4,8}$/.test(hsn) ? "4 to 8 digits" : null;
  const ok = !titleProblem && !optionProblem && !tooMany && onRows.length > 0 && problems.every((p) => !p) && !hsnProblem;

  const body = (): ProductInput => {
    const variants: VariantInput[] = onRows.map((values) => {
      const r = rowAt(values);
      return {
        ...(values.length ? { values } : {}),
        price: paiseOfText(r.price)!,
        mrp: r.mrp.trim() ? paiseOfText(r.mrp) : null,
        stock: Number(r.stock),
        sku: r.sku.trim() || null,
      };
    });
    return {
      title: title.trim(),
      description: description.trim() || null,
      options: usable.map((o) => ({ name: o.name.trim(), values: o.values })),
      variants,
      hsn: hsn || null,
      gstRateBps: gst === GST_RATES[0] ? null : Math.round(parseFloat(gst) * 100),
      status: live ? "live" : "hidden",
    };
  };

  const save = async () => {
    setChecked(true);
    setFailure(null);
    if (!ok) return;
    const next = body();
    const before = product
      ? JSON.stringify([product.options, product.variants.map((v) => [v.values, v.price, v.mrp, v.stock, v.sku])])
      : "";
    const after = JSON.stringify([next.options, next.variants.map((v) => [v.values ?? [], v.price, v.mrp ?? null, v.stock, v.sku ?? null])]);
    setSaving(true);
    try {
      await onSave(next, !product || before !== after, photo?.blob ?? null);
    } catch (err) {
      setFailure(formError(err).message);
    } finally {
      setSaving(false);
    }
  };

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setFailure(null);
    try {
      const blob = await shrinkPhoto(file, PHOTO_SIDE, 1);
      if (product && onPhoto) {
        setPhotoBusy(true);
        await onPhoto(blob);
      } else {
        if (photo) URL.revokeObjectURL(photo.url);
        setPhoto({ blob, url: URL.createObjectURL(blob) });
      }
    } catch (err) {
      setFailure(err instanceof ApiError ? formError(err).message : "That file is not a photo we can read.");
    } finally {
      setPhotoBusy(false);
    }
  };
  const dropPhoto = async () => {
    if (product && onPhoto) {
      setPhotoBusy(true);
      try {
        await onPhoto(null);
      } catch (err) {
        setFailure(formError(err).message);
      } finally {
        setPhotoBusy(false);
      }
    } else {
      if (photo) URL.revokeObjectURL(photo.url);
      setPhoto(null);
    }
  };
  const remove = async () => {
    if (!onDelete) return;
    setDeleting("busy");
    try {
      await onDelete();
    } catch (err) {
      setFailure(formError(err).message);
      setDeleting(null);
    }
  };

  const shown = photo?.url ?? product?.photo?.url ?? null;
  const show = (message: string | null) => (checked ? (message ?? undefined) : undefined);

  return (
    <form
      className={vendor.form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      {removed && product?.removal && (
        <p className={vendor.note} data-tone="danger">
          <Icon name="alert" size={20} />
          <span>
            <strong>Taken down by Ruxstar: </strong>
            {product.removal.reason} Customers can’t see it.
          </span>
        </p>
      )}

      <h2 className={vendor.overline}>Photo</h2>
      <div className={vendor.inline}>
        <span className={styles.photoPick}>{shown ? <img src={shown} width={96} height={96} alt="Product photo" /> : <Icon name="image" size={28} />}</span>
        {canPhoto ? (
          <span className={order.actions}>
            <Button variant="secondary" loading={photoBusy} icon={<Icon name="camera" size={16} />} onClick={() => fileInput.current?.click()}>
              {shown ? "Change photo" : "Add a photo"}
            </Button>
            {shown && (
              <Button variant="ghost" disabled={photoBusy} onClick={() => void dropPhoto()}>
                Remove
              </Button>
            )}
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                void pickPhoto(file);
              }}
            />
          </span>
        ) : (
          <span className={order.faint}>The owner adds the photo.</span>
        )}
      </div>
      <p className={order.faint}>One square photo, cropped from the middle. Customers see it on the shop and the product page.</p>

      <h2 className={vendor.overline}>About it</h2>
      <Input label="Name" value={title} maxLength={TITLE_MAX} onChange={(e) => setTitle(e.target.value)} error={show(titleProblem)} placeholder="Cotton kurta" />
      <TextArea label="Description (optional)" value={description} onChange={setDescription} max={DESCRIPTION_MAX} placeholder="Material, fit, what’s in the box…" />

      <h2 className={vendor.overline}>Options</h2>
      <p className={order.small}>Add Size, Colour or both when it comes in more than one. Each combination gets its own price, MRP and stock.</p>
      {options.map((o, i) => (
        <OptionEditor
          key={i}
          option={o}
          index={i}
          maxValues={rules.maxValues}
          taken={options.filter((_, j) => j !== i).map((x) => x.name.trim())}
          onChange={(next) => setOptions((now) => now.map((x, j) => (j === i ? next : x)))}
          onRemove={() => setOptions((now) => now.filter((_, j) => j !== i))}
        />
      ))}
      {options.length < rules.maxOptions && (
        <div>
          <Button variant="secondary" icon={<Icon name="plus" size={16} />} onClick={() => setOptions((now) => [...now, { name: "", values: [] }])}>
            {options.length ? "Add another option" : "Add an option"}
          </Button>
        </div>
      )}
      {checked && optionProblem && (
        <p className={vendor.error} role="alert">
          {optionProblem}
        </p>
      )}

      <h2 className={vendor.overline}>{usable.length ? "Variants" : "Price and stock"}</h2>
      {table.length > 1 && (
        <div className={styles.bulk} role="group" aria-label="Set for every variant on sale">
          <Input label="Price for all (₹)" value={bulk.price} inputMode="decimal" onChange={(e) => setBulk((b) => ({ ...b, price: rupees(e.target.value) }))} />
          <Input label="MRP for all (₹)" value={bulk.mrp} inputMode="decimal" onChange={(e) => setBulk((b) => ({ ...b, mrp: rupees(e.target.value) }))} />
          <Input label="Stock for all" value={bulk.stock} inputMode="numeric" onChange={(e) => setBulk((b) => ({ ...b, stock: digits(e.target.value) }))} />
          <Button variant="secondary" disabled={!bulk.price && !bulk.mrp && !bulk.stock} onClick={applyBulk}>
            Apply
          </Button>
        </div>
      )}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption className="sr-only">Price, MRP, stock and SKU for each variant</caption>
          <thead>
            <tr>
              {usable.length > 0 && <th scope="col">Sell</th>}
              {usable.length > 0 && <th scope="col">{usable.map((o) => o.name.trim()).join(" · ")}</th>}
              <th scope="col">Price (₹)</th>
              <th scope="col">MRP (₹)</th>
              <th scope="col">Stock</th>
              <th scope="col">SKU</th>
            </tr>
          </thead>
          <tbody>
            {table.map((values) => {
              const k = variantKey(values);
              const r = rowAt(values);
              const label = values.join(" · ") || "This product";
              const problem = checked && r.on ? rowProblem(r) : null;
              const price = paiseOfText(r.price);
              return (
                <tr key={k} data-off={!r.on || undefined}>
                  {usable.length > 0 && (
                    <td>
                      <input type="checkbox" checked={r.on} aria-label={`Sell ${label}`} onChange={(e) => setRow(values, { on: e.target.checked })} />
                    </td>
                  )}
                  {usable.length > 0 && <th scope="row">{label}</th>}
                  <td>
                    <input
                      className={styles.cell}
                      inputMode="decimal"
                      value={r.price}
                      disabled={!r.on}
                      aria-label={`Price of ${label}`}
                      aria-invalid={!!problem && (price === null || price < 100 || price > MAX_PRICE)}
                      onChange={(e) => setRow(values, { price: rupees(e.target.value) })}
                    />
                  </td>
                  <td>
                    <input
                      className={styles.cell}
                      inputMode="decimal"
                      value={r.mrp}
                      disabled={!r.on}
                      placeholder="—"
                      aria-label={`MRP of ${label}`}
                      aria-invalid={!!problem && problem.startsWith("MRP")}
                      onChange={(e) => setRow(values, { mrp: rupees(e.target.value) })}
                    />
                  </td>
                  <td>
                    <input
                      className={styles.cell}
                      inputMode="numeric"
                      value={r.stock}
                      disabled={!r.on}
                      aria-label={`Stock of ${label}`}
                      aria-invalid={!!problem && problem.startsWith("Stock")}
                      onChange={(e) => setRow(values, { stock: digits(e.target.value) })}
                    />
                  </td>
                  <td>
                    <input
                      className={styles.cell}
                      value={r.sku}
                      disabled={!r.on}
                      maxLength={SKU_MAX}
                      placeholder="—"
                      aria-label={`SKU of ${label}`}
                      onChange={(e) => setRow(values, { sku: e.target.value })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className={order.faint}>
        {usable.length
          ? `${onRows.length} of ${table.length} combinations on sale. Untick one you don’t sell. Up to ${rules.maxVariants}.`
          : "MRP is optional: when it’s higher than the price, customers see it struck through."}
      </p>
      {checked && (tooMany || onRows.length === 0 || problems.some(Boolean)) && (
        <p className={vendor.error} role="alert">
          {tooMany
            ? `Up to ${rules.maxVariants} variants. Untick some, or use fewer values.`
            : onRows.length === 0
              ? "Sell at least one combination."
              : `Check the rows marked in red: ${problems.find(Boolean)}.`}
        </p>
      )}
      {product && <p className={order.faint}>Changing options or the table replaces it, stock included. To change only stock, use Stock on the products list.</p>}

      <h2 className={vendor.overline}>For invoices (optional)</h2>
      <div className={order.pair}>
        <Input label="HSN code" value={hsn} inputMode="numeric" onChange={(e) => setHsn(digits(e.target.value, 8))} error={show(hsnProblem)} />
        <Select label="GST rate" value={gst} options={GST_RATES} placeholder="Choose a rate" onChange={setGst} />
      </div>

      <h2 className={vendor.overline}>On sale</h2>
      <div className={vendor.switches}>
        <Switch checked={live} onChange={setLive} disabled={removed} description={live ? "Customers can see and buy it." : "Hidden from customers. Turn it on when it’s ready."}>
          On sale
        </Switch>
      </div>

      {failure && (
        <p className={vendor.error} role="alert">
          {failure}
        </p>
      )}
      <div className={vendor.actions}>
        <Button type="submit" size="lg" loading={saving} disabled={removed}>
          {product ? "Save" : "Add product"}
        </Button>
        {product && onDelete && deleting !== "ask" && (
          <Button variant="ghost" icon={<Icon name="trash" size={16} />} disabled={saving} onClick={() => setDeleting("ask")}>
            Delete
          </Button>
        )}
      </div>
      {deleting && (
        <div className={vendor.note} data-tone="danger">
          <Icon name="trash" size={20} />
          <div className={vendor.form}>
            <span>
              <strong>Delete this product?</strong> It comes off your shop. Orders already placed keep it.
            </span>
            <div className={vendor.actions}>
              <Button variant="danger" loading={deleting === "busy"} onClick={() => void remove()}>
                Delete
              </Button>
              <Button variant="ghost" disabled={deleting === "busy"} onClick={() => setDeleting(null)}>
                Keep it
              </Button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
