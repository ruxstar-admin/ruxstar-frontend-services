"use client";

import { useEffect, useRef, useState } from "react";
import { Button, ButtonLink, Icon, Input } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useBack } from "@/components/social/Shell";
import { useOnSignedOut } from "@/components/social/session";
import { CheckoutCoupons } from "@/components/coupons/CheckoutCoupons";
import { FileItem, PriceList } from "@/components/shop/OrderParts";
import { formError, getMe } from "@/lib/api/account";
import { newIdempotencyKey } from "@/lib/api/client";
import {
  myOrders,
  placeOrder,
  PRINT_FILE_MAX_BYTES,
  PRINT_FILE_TYPES,
  quoteOrder,
  requiredOption,
  uploadPrintFile,
  type OrderAddress,
  type PrintFile,
  type Quote,
} from "@/lib/api/orders";
import { getShop, money, OPTION_LABELS, readyLine, type Shop, type ShopProduct } from "@/lib/api/shops";
import social from "@/components/social/social.module.css";
import shopStyles from "@/components/shop/shop.module.css";
import styles from "@/components/shop/order.module.css";

const MAX_FILES = 10;
const MAX_QUANTITY = 10_000;
const QUOTE_DELAY_MS = 350;

const digits = (text: string, max: number) => text.replace(/\D/g, "").slice(0, max);
const titleCase = (text: string) => text.replace(/\b\p{L}/gu, (c) => c.toUpperCase());

/** Binding starts at "None"; paper size at A4. Everything else is the customer's call. */
function defaultsFor(product: ShopProduct): Record<string, string> {
  const picked: Record<string, string> = {};
  for (const { option, values } of product.options) {
    if (values.includes("None")) picked[option] = "None";
    else if (option === "paperSize" && values.includes("A4")) picked[option] = "A4";
  }
  return picked;
}

const colourFor = (product: ShopProduct): "bw" | "color" | undefined =>
  product.pricing !== "per_page" ? undefined : product.bw ? "bw" : product.color ? "color" : undefined;

function deliversTo(shop: Shop, city: string) {
  const name = city.trim().toLowerCase();
  return !name || shop.deliversEverywhere || shop.cities.includes(name) || shop.city.toLowerCase() === name;
}

function Chips<K extends string>({ options, value, onChange, small }: { options: { key: K; label: string }[]; value: K; onChange: (key: K) => void; small?: boolean }) {
  return (
    <div className={shopStyles.chips}>
      {options.map((o) => (
        <button key={o.key} type="button" className={small ? shopStyles.subChip : shopStyles.chip} aria-pressed={o.key === value} onClick={() => onChange(o.key)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function OptionPicker({ product, option, values, value, onChange }: { product: ShopProduct; option: string; values: string[]; value: string; onChange: (v: string) => void }) {
  const required = option === requiredOption(product);
  const extra = (v: string) => product.extras.find((x) => x.option === option && x.value === v)?.price;
  const choices = [
    ...(required || values.includes("None") ? [] : [{ key: "", label: option === "doubleSided" ? "Single-sided" : "Any" }]),
    ...values.map((v) => ({ key: v, label: extra(v) ? `${v} +${money(extra(v)!)}` : v })),
  ];
  return (
    <div className={styles.section}>
      <span className={styles.label}>
        {OPTION_LABELS[option] ?? option}
        {required && <span className={styles.faint}> · required</span>}
      </span>
      <Chips small options={choices} value={value} onChange={onChange} />
    </div>
  );
}

function OrderForm({ shop, initialProduct }: { shop: Shop; initialProduct?: string }) {
  const back = useBack();
  const [productId, setProductId] = useState(() => (shop.catalog.find((p) => p.id === initialProduct) ?? shop.catalog[0]).id);
  const product = shop.catalog.find((p) => p.id === productId)!;
  const perPage = product.pricing === "per_page";
  const [options, setOptions] = useState(() => defaultsFor(product));
  const [colour, setColour] = useState(() => colourFor(product));
  const [quantity, setQuantity] = useState(() => String(perPage ? 1 : product.minQuantity));
  const [files, setFiles] = useState<PrintFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [address, setAddress] = useState<OrderAddress>({ name: "", phone: "", line: "", city: shop.city, pincode: "" });
  const [note, setNote] = useState("");
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [priced, setPriced] = useState<{ key: string; quote: Quote | null; error: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const attempt = useRef(newIdempotencyKey());

  const qty = Number(quantity) || 0;
  const fileIds = files.map((f) => f.id);
  const needs = requiredOption(product);
  const missing = product.options.some((o) => o.option === needs) && !options[needs];

  // The last order's address, or the account's name, phone and city.
  useEffect(() => {
    let live = true;
    Promise.all([myOrders().catch(() => null), getMe().catch(() => null)]).then(([orders, me]) => {
      if (!live) return;
      const last = orders?.items[0]?.address;
      setAddress((now) =>
        now.name || now.phone || now.line
          ? now
          : (last ?? { name: me?.name ?? "", phone: (me?.phone ?? "").replace(/\D/g, "").slice(-10), line: "", city: me?.city || shop.city, pincode: "" }),
      );
    });
    return () => {
      live = false;
    };
  }, [shop.city]);

  const choiceKey = JSON.stringify([productId, options, colour, qty, fileIds, couponCode]);
  const priceable = !missing && qty >= 1 && !(perPage && !colour);
  const current = priceable && priced?.key === choiceKey ? priced : null;
  const quote = current?.quote ?? null;
  const quoteError = current?.error ?? null;
  // The offers stay on screen while a new price loads, so the list doesn't jump.
  const offers = priceable ? (priced?.quote?.offers ?? null) : null;
  useEffect(() => {
    attempt.current = newIdempotencyKey();
    if (!priceable) return;
    let live = true;
    const timer = setTimeout(() => {
      quoteOrder({ shopId: shop.id, product: productId, options, colour, quantity: qty, fileIds, couponCode: couponCode ?? undefined })
        .then((q) => live && setPriced({ key: choiceKey, quote: q, error: null }))
        .catch((err) => live && setPriced({ key: choiceKey, quote: null, error: formError(err).message }));
    }, QUOTE_DELAY_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
    // choiceKey covers every input to the quote.
  }, [choiceKey]);

  const pick = (id: string) => {
    const next = shop.catalog.find((p) => p.id === id)!;
    setProductId(next.id);
    setOptions(defaultsFor(next));
    setColour(colourFor(next));
    setQuantity(String(next.pricing === "per_page" ? 1 : next.minQuantity));
  };

  const addFile = async (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (!(PRINT_FILE_TYPES as readonly string[]).includes(file.type)) {
      setError("Add a PDF, JPG or PNG file.");
      return;
    }
    if (file.size > PRINT_FILE_MAX_BYTES) {
      setError("Files can be up to 25 MB. Compress it or split it and try again.");
      return;
    }
    setUploading(true);
    try {
      const saved = await uploadPrintFile(file);
      setFiles((now) => [...now, saved]);
    } catch (err) {
      setError(formError(err).message);
    } finally {
      setUploading(false);
    }
  };

  const set = (field: keyof OrderAddress) => (text: string) =>
    setAddress((now) => ({ ...now, [field]: field === "phone" ? digits(text, 10) : field === "pincode" ? digits(text, 6) : text }));
  const cityOk = deliversTo(shop, address.city);
  const addressOk =
    address.name.trim().length >= 2 &&
    /^[6-9]\d{9}$/.test(address.phone) &&
    address.line.trim().length >= 5 &&
    address.city.trim().length >= 2 &&
    cityOk &&
    /^[1-9]\d{5}$/.test(address.pincode);
  const ready = !!quote && files.length > 0 && addressOk && shop.open && !uploading;

  const place = async () => {
    if (!ready) return;
    setPlacing(true);
    setError(null);
    try {
      const { order, checkoutUrl } = await placeOrder(
        {
          shopId: shop.id,
          product: product.id,
          options,
          colour,
          quantity: qty,
          fileIds,
          address: { ...address, name: address.name.trim(), line: address.line.trim(), city: address.city.trim() },
          note: note.trim() || undefined,
          couponCode: quote?.coupon?.code,
          returnTo: `${window.location.origin}/orders`,
        },
        attempt.current,
      );
      // Back from the checkout page lands on the order, not this form.
      window.history.replaceState(null, "", `/orders/${order.id}`);
      window.location.assign(checkoutUrl);
    } catch (err) {
      setError(formError(err).message);
      setPlacing(false);
    }
  };

  const hint = !files.length ? "Add the file to print" : missing ? `Choose a ${needs === "size" ? "size" : "paper size"}` : !addressOk ? "Fill in the delivery address" : null;

  return (
    <div className={styles.page}>
      <button type="button" className={social.back} onClick={back}>
        <Icon name="arrow-left" size={18} /> Back
      </button>
      <div>
        <h1 className={styles.title}>Place order</h1>
        <p className={styles.small}>{shop.name}</p>
      </div>

      <section className={styles.section}>
        <h2 className={styles.overline}>What to print</h2>
        <Chips options={shop.catalog.map((p) => ({ key: p.id, label: p.label }))} value={productId} onChange={pick} />
      </section>

      {product.options.map(({ option, values }) => (
        <OptionPicker
          key={`${productId}-${option}`}
          product={product}
          option={option}
          values={values}
          value={options[option] ?? ""}
          onChange={(v) =>
            setOptions((now) => {
              const next = { ...now };
              if (v) next[option] = v;
              else delete next[option];
              return next;
            })
          }
        />
      ))}

      {perPage && (
        <div className={styles.section}>
          <span className={styles.label}>Print in</span>
          <Chips
            small
            value={colour ?? ""}
            onChange={(v) => setColour(v as "bw" | "color")}
            options={[
              ...(product.bw ? [{ key: "bw", label: `Black & white · ${money(product.bw)} a page` }] : []),
              ...(product.color ? [{ key: "color", label: `Colour · ${money(product.color)} a page` }] : []),
            ]}
          />
        </div>
      )}

      <Input
        label={perPage ? "Copies" : "Quantity"}
        inputMode="numeric"
        value={quantity}
        onChange={(e) => setQuantity(String(Math.min(MAX_QUANTITY, Number(digits(e.target.value, 5)) || 0) || ""))}
        hint={product.minQuantity > 1 ? `Minimum ${product.minQuantity}${perPage ? " pages" : ""}` : perPage ? "Every page of your files, this many times" : undefined}
      />

      <section className={styles.section}>
        <h2 className={styles.overline}>Your files</h2>
        {files.map((file) => (
          <FileItem
            key={file.id}
            file={file}
            action={
              <button type="button" className={styles.remove} aria-label={`Remove ${file.name}`} onClick={() => setFiles((now) => now.filter((f) => f.id !== file.id))}>
                <Icon name="close" size={18} />
              </button>
            }
          />
        ))}
        {files.length < MAX_FILES && (
          <label className={styles.drop} data-busy={uploading || undefined}>
            <Icon name="plus" size={20} />
            <span className={styles.fileText}>
              <span className={styles.fileName}>{uploading ? "Uploading…" : files.length ? "Add another file" : "Add a file"}</span>
              <span className={styles.faint}>PDF, JPG or PNG, up to 25 MB. Only this shop can open it.</span>
            </span>
            <input
              type="file"
              accept={PRINT_FILE_TYPES.join(",")}
              disabled={uploading}
              onChange={(e) => {
                void addFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.overline}>Deliver to</h2>
        <Input label="Name" value={address.name} onChange={(e) => set("name")(e.target.value)} maxLength={80} autoComplete="name" />
        <Input label="Phone" prefix="+91" value={address.phone} onChange={(e) => set("phone")(e.target.value)} inputMode="tel" maxLength={10} autoComplete="tel-national" />
        <Input label="House, street and area" value={address.line} onChange={(e) => set("line")(e.target.value)} maxLength={300} autoComplete="street-address" />
        <div className={styles.pair}>
          <Input
            label="City"
            value={address.city}
            onChange={(e) => set("city")(e.target.value)}
            maxLength={60}
            autoComplete="address-level2"
            error={cityOk ? undefined : `${shop.name} delivers to ${shop.cities.map(titleCase).join(", ") || shop.city} only`}
          />
          <Input label="Pincode" value={address.pincode} onChange={(e) => set("pincode")(e.target.value)} inputMode="numeric" maxLength={6} autoComplete="postal-code" />
        </div>
        <label className={styles.label} htmlFor="order-note">
          Note for the shop
        </label>
        <textarea
          id="order-note"
          className={styles.textarea}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          placeholder="Optional: colours, placement, deadline…"
        />
      </section>

      {priceable && (
        <section className={styles.section}>
          <h2 className={styles.overline}>Offers</h2>
          <CheckoutCoupons
            offers={offers}
            applied={quote?.coupon ?? null}
            discount={quote?.discount ?? 0}
            problem={quote?.couponProblem ?? null}
            onApply={setCouponCode}
            onRemove={() => setCouponCode(null)}
          />
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.overline}>Price</h2>
        <div className={styles.panel}>
          {quote ? (
            <PriceList price={quote} pricing={product.pricing} />
          ) : (
            <p className={quoteError ? styles.error : styles.faint}>
              {quoteError ?? (missing ? `Choose a ${needs === "size" ? "size" : "paper size"} to see the price.` : "Working out the price…")}
            </p>
          )}
        </div>
      </section>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.bar}>
        <span className={styles.barText}>
          <strong>{quote ? money(quote.total) : "—"}</strong>
          <span className={styles.faint}>{!shop.open ? "This shop is closed right now" : (hint ?? readyLine(quote?.turnaroundDays ?? product.turnaroundDays))}</span>
        </span>
        <Button size="lg" onClick={place} loading={placing} disabled={!ready}>
          Pay
        </Button>
      </div>
    </div>
  );
}

/** Ordering from a print shop: what to print, the file, where to deliver, then payment on Cashfree. Same as the app. */
export function PlaceOrderScreen({ id, product }: { id: string; product?: string }) {
  const onSignedOut = useOnSignedOut();
  const [shop, setShop] = useState<Shop | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let live = true;
    getShop(id).then(
      (s) => live && setShop(s),
      (err) => live && !onSignedOut(err) && setError(err),
    );
    return () => {
      live = false;
    };
  }, [id, onSignedOut]);

  if (shop && shop.catalog.length) return <OrderForm shop={shop} initialProduct={product} />;
  if (shop || error) {
    return (
      <Empty title={shop ? "Nothing to order yet" : "Could not load this shop"}>
        <p>{shop ? "This shop has not priced anything yet." : formError(error).message}</p>
        <ButtonLink href={`/b/${id}`} variant="secondary">
          Back to the shop
        </ButtonLink>
      </Empty>
    );
  }
  return (
    <div className={styles.page} aria-busy>
      <div className={shopStyles.skeletonCard} />
    </div>
  );
}
