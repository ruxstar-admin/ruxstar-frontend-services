"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, ButtonLink, Icon, Segmented, Skeleton, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { Back } from "@/components/vendor/parts";
import { deskBack, useStoreDesk } from "@/components/store/desk";
import { PriceTag } from "@/components/store/cards";
import { formError } from "@/lib/api/account";
import { deskProducts, setDeskStock, type VendorProduct, type VendorProductFilters } from "@/lib/api/store";
import { LOW_STOCK, plural } from "@/lib/store";
import social from "@/components/social/social.module.css";
import order from "@/components/shop/order.module.css";
import styles from "@/components/store/store.module.css";

const DEBOUNCE_MS = 300;
const MAX_STOCK = 100_000;

type View = "all" | "live" | "hidden" | "low" | "removed";
const VIEWS = [
  { value: "all", label: "All" },
  { value: "live", label: "On sale" },
  { value: "hidden", label: "Off sale" },
  { value: "low", label: "Low stock" },
  { value: "removed", label: "Taken down" },
] as const satisfies readonly { value: View; label: string }[];

const STATUS_TAG = { live: null, hidden: { label: "Off sale", tone: "neutral" }, removed: { label: "Taken down", tone: "danger" } } as const;

const totalStock = (p: VendorProduct) => p.variants.reduce((s, v) => s + v.stock, 0);

/** Each variant's stock as a number box; Save sets them all at once. Prices and options stay as they are. */
function StockEditor({ product, onSaved, onClose }: { product: VendorProduct; onSaved: (p: VendorProduct) => void; onClose: () => void }) {
  const [counts, setCounts] = useState(() => new Map(product.variants.map((v) => [v.id, String(v.stock)])));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changed = product.variants.filter((v) => counts.get(v.id) !== String(v.stock));
  const bad = changed.some((v) => !/^\d+$/.test(counts.get(v.id) ?? "") || Number(counts.get(v.id)) > MAX_STOCK);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      onSaved(await setDeskStock(product.id, changed.map((v) => ({ variantId: v.id, stock: Number(counts.get(v.id)) }))));
      onClose();
    } catch (err) {
      setError(formError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={order.panel}>
      <ul className={styles.stockList}>
        {product.variants.map((v) => {
          const label = v.values.join(" · ") || "Stock";
          return (
            <li key={v.id} className={styles.stockRow}>
              <label htmlFor={`stock-${v.id}`} className={styles.lineText}>
                <strong>{label}</strong>
                {v.sku && <span className={order.faint}>{`SKU ${v.sku}`}</span>}
              </label>
              <input
                id={`stock-${v.id}`}
                className={styles.cell}
                inputMode="numeric"
                value={counts.get(v.id) ?? ""}
                aria-invalid={!/^\d+$/.test(counts.get(v.id) ?? "") || undefined}
                onChange={(e) => setCounts((now) => new Map(now).set(v.id, e.target.value.replace(/\D/g, "").slice(0, 6)))}
              />
            </li>
          );
        })}
      </ul>
      {error && (
        <p className={order.error} role="alert">
          {error}
        </p>
      )}
      <div className={order.actions}>
        <Button loading={saving} disabled={!changed.length || bad} onClick={() => void save()}>
          {changed.length ? `Save ${plural(changed.length, "change")}` : "Save"}
        </Button>
        <Button variant="ghost" disabled={saving} onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}

function ProductRow({ shopId, product, canEdit, canStock, onChanged }: { shopId: string; product: VendorProduct; canEdit: boolean; canStock: boolean; onChanged: (p: VendorProduct) => void }) {
  const [stocking, setStocking] = useState(false);
  const tag = STATUS_TAG[product.status];
  const stock = totalStock(product);
  const low = product.variants.filter((v) => v.stock <= LOW_STOCK).length;
  const inner = (
    <>
      <span className={styles.thumb}>{product.photo ? <img src={product.photo.url} width={56} height={56} alt="" loading="lazy" decoding="async" /> : <Icon name="bag" size={22} />}</span>
      <span className={styles.lineText}>
        <span className={styles.lineTitle}>{product.title}</span>
        <PriceTag price={product.priceFrom} mrp={product.mrpFrom} from={product.variants.length > 1} />
        <span className={low ? styles.low : order.faint}>
          {`${plural(stock, "in stock", "in stock")}${product.variants.length > 1 ? ` · ${plural(product.variants.length, "variant")}` : ""}${low ? ` · ${plural(low, "running low", "running low")}` : ""}`}
        </span>
      </span>
      <span className={styles.lineEnd}>
        {tag && <Tag tone={tag.tone}>{tag.label}</Tag>}
        {canEdit && <Icon name="chevron-right" size={18} />}
      </span>
    </>
  );
  return (
    <li className={styles.picker}>
      {canEdit ? (
        <Link href={`/store/${shopId}/products/${product.id}`} className={styles.productRow}>
          {inner}
        </Link>
      ) : (
        <div className={styles.productRow}>{inner}</div>
      )}
      {canStock && product.status !== "removed" &&
        (stocking ? (
          <StockEditor product={product} onSaved={onChanged} onClose={() => setStocking(false)} />
        ) : (
          <div>
            <Button variant="ghost" icon={<Icon name="edit" size={16} />} onClick={() => setStocking(true)}>
              Stock
            </Button>
          </div>
        ))}
    </li>
  );
}

function Products({ shopId, filters, canEdit, canStock }: { shopId: string; filters: VendorProductFilters; canEdit: boolean; canStock: boolean }) {
  const { items, setItems, loading, loadingMore, hasMore, error, more, reload } = usePages((cursor) => deskProducts(shopId, filters, cursor));
  const sentinel = useNearEnd(more, hasMore && !error);
  if (loading) {
    return (
      <div className={order.rows} aria-busy>
        <Skeleton height={80} radius={16} />
        <Skeleton height={80} radius={16} />
      </div>
    );
  }
  if (error && items.length === 0) {
    return (
      <div className={social.failed} role="alert">
        <p>{formError(error).message}</p>
        <Button variant="secondary" onClick={reload}>
          Try again
        </Button>
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <Empty title={filters.q || filters.status || filters.lowStock !== undefined ? "Nothing matches" : "No products yet"}>
        <p>{filters.q || filters.status || filters.lowStock !== undefined ? "Try another name or view." : "Products the shop sells show up here."}</p>
      </Empty>
    );
  }
  return (
    <>
      <ul className={styles.lines}>
        {items.map((p) => (
          <ProductRow key={p.id} shopId={shopId} product={p} canEdit={canEdit} canStock={canStock} onChanged={(next) => setItems((now) => now.map((x) => (x.id === next.id ? next : x)))} />
        ))}
      </ul>
      {hasMore && <div ref={sentinel} className={social.sentinel} aria-hidden />}
      {loadingMore && <Skeleton height={80} radius={16} />}
    </>
  );
}

/** A local shop's products for the owner and team: search, what's off sale or low, a quick stock edit, and the full form. */
export function DeskProductsScreen({ id }: { id: string }) {
  const { stores, store, can } = useStoreDesk(id);
  const [view, setView] = useState<View>("all");
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const back = store?.owner ? deskBack(store, id) : { href: `/store/${id}`, label: "Orders" };

  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [text]);

  if (stores.data && (!store || !can("store.stock"))) {
    return (
      <Empty title="Not open to you">
        <p>{store ? "The owner hasn’t let you change stock here." : "This shop isn’t one you own or work at."}</p>
        <ButtonLink href={store ? `/store/${id}` : "/store"} variant="secondary">
          Back
        </ButtonLink>
      </Empty>
    );
  }

  const filters: VendorProductFilters = {
    ...(q ? { q: q.slice(0, 60) } : {}),
    ...(view === "live" || view === "hidden" || view === "removed" ? { status: view } : {}),
    ...(view === "low" ? { lowStock: LOW_STOCK } : {}),
  };
  return (
    <div className={order.page}>
      <Back href={back.href}>{back.label}</Back>
      <div className={order.titleRow}>
        <h1 className={order.title}>Products & stock</h1>
        {store?.owner && (
          <ButtonLink href={`/store/${id}/products/new`} icon={<Icon name="plus" size={16} />}>
            Add product
          </ButtonLink>
        )}
      </div>
      <label className={social.searchBox}>
        <Icon name="search" size={20} />
        <input className={social.searchInput} type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Product name" aria-label="Search products" maxLength={60} />
      </label>
      <Segmented label="Which products" options={VIEWS} value={view} onChange={setView} />
      {store && <Products key={`${view}|${q}`} shopId={id} filters={filters} canEdit={can("store.products")} canStock={can("store.stock")} />}
    </div>
  );
}
