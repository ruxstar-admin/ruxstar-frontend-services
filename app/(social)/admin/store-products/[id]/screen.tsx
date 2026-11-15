"use client";

import { useEffect, useRef, useState } from "react";
import { Needs, useCan } from "@/components/admin/AdminFrame";
import { Failed, Fact, ReasonForm, date, styles } from "@/components/admin/parts";
import { ProductPhoto } from "@/components/store/cards";
import { useOnSignedOut } from "@/components/social/session";
import { Button, ButtonLink, Card, Icon, Skeleton, Tag, useToast } from "@/components/ui";
import { formError } from "@/lib/api/account";
import { ApiError, newIdempotencyKey } from "@/lib/api/client";
import { money } from "@/lib/api/shops";
import { consoleProduct, takeDownProduct, type ConsoleProduct } from "@/lib/api/store";
import { optionsText, plural, PRODUCT_STATUS, variantOptions } from "@/lib/store";
import { ago } from "@/lib/time";
import eventStyles from "@/components/events/events.module.css";

/** Live and hidden products can be taken down; orders already placed go on. */
function TakeDown({ product, onDone }: { product: ConsoleProduct; onDone: (next: ConsoleProduct) => void }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const canManage = useCan("businesses.manage");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const key = useRef(newIdempotencyKey());
  if (!canManage || product.status === "removed") return null;

  async function takeDown(reason: string) {
    setBusy(true);
    try {
      const done = await takeDownProduct(product.id, reason, key.current);
      key.current = newIdempotencyKey();
      setOpen(false);
      onDone(done);
      toast("Product taken down. The shop has been told why.", "success");
    } catch (err) {
      if (!(err instanceof ApiError && err.code === "NETWORK")) key.current = newIdempotencyKey();
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setBusy(false);
    }
  }

  if (open) {
    return (
      <ReasonForm
        prompt={`Take down ${product.title}? It leaves the listings and can’t be changed or sold again. Orders already placed go on. The shop sees your reason. This can’t be undone.`}
        placeholder="For example: this item can’t be sold on Ruxstar."
        confirm="Take down"
        busy={busy}
        onCancel={() => setOpen(false)}
        onSubmit={(reason) => void takeDown(reason)}
      />
    );
  }

  return (
    <div className={styles.actions}>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Take down
      </Button>
    </div>
  );
}

/** One local shop product for the Ruxstar team: its words, every variant with price and stock, and taking it down. */
export function StoreProductCaseScreen({ id }: { id: string }) {
  const onSignedOut = useOnSignedOut();
  const canAudit = useCan("audit.view");
  const [product, setProduct] = useState<ConsoleProduct | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    consoleProduct(id).then(
      (next) => live && setProduct(next),
      (err) => live && !onSignedOut(err) && setError(err),
    );
    return () => {
      live = false;
    };
  }, [id, attempt, onSignedOut]);

  const p = product;
  const status = p ? PRODUCT_STATUS[p.status] : null;

  return (
    <Needs need="businesses.view">
      <div className={styles.page}>
        <div>
          <ButtonLink href="/admin/store-products" variant="ghost" icon={<Icon name="arrow-left" size={18} />}>
            Shop products
          </ButtonLink>
        </div>

        {error ? (
          <Failed
            error={error}
            onRetry={() => {
              setError(null);
              setAttempt((n) => n + 1);
            }}
          />
        ) : !p || !status ? (
          <Skeleton height={420} radius={16} />
        ) : (
          <Card as="section" padding="lg" className={styles.page}>
            <ProductPhoto photo={p.photo} title={p.title} className={eventStyles.poster} />
            <div className={styles.head}>
              <div>
                <h1 className={styles.title}>{p.title}</h1>
                <p className={styles.muted}>{`${p.business.name} · ${p.city}`}</p>
              </div>
              <div className={styles.tags}>
                <Tag tone={status.tone}>{status.label}</Tag>
              </div>
            </div>

            {p.removal && <p className={styles.note} data-tone="danger">{`Taken down by Ruxstar ${ago(p.removal.at)}: ${p.removal.reason}`}</p>}

            <dl className={styles.facts}>
              <Fact label="Price" value={`From ${money(p.priceFrom)}${p.mrpFrom ? ` · MRP from ${money(p.mrpFrom)}` : ""}`} />
              <Fact label="Options" value={p.options.length ? p.options.map((o) => `${o.name}: ${o.values.join(", ")}`).join(" · ") : "None"} />
              <Fact label="HSN" value={p.hsn ?? "Not given"} />
              <Fact label="GST" value={p.gstRateBps === null ? "Ruxstar’s rate" : `${p.gstRateBps / 100}%`} />
              <Fact label="Ways to get it" value={[p.delivery && "Delivery", p.pickup && "Pickup"].filter(Boolean).join(" or ") || "None yet"} />
              <Fact label="Returns" value={p.returnRule} />
              <Fact label="Added" value={date(p.createdAt)} />
              <Fact label="Changed" value={ago(p.updatedAt)} />
              <Fact label="Product id" value={p.id} />
            </dl>

            {p.description && <p className={styles.text}>{p.description}</p>}

            <section className={styles.group}>
              <h2 className={styles.subtitle}>{`Variants · ${p.variants.length}`}</h2>
              <ul className={styles.list}>
                {p.variants.map((v) => (
                  <li key={v.id} className={styles.item}>
                    <div className={styles.row}>
                      <span className={styles.whoRow}>
                        <span className={styles.name}>{optionsText(variantOptions(p.options, v)) || "One version"}</span>
                        <span className={`${styles.muted} ${styles.line}`}>
                          {[money(v.price), v.mrp ? `MRP ${money(v.mrp)}` : null, v.sku ? `SKU ${v.sku}` : null].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className={styles.tags}>
                        <Tag tone={v.stock > 0 ? "neutral" : "warning"}>{v.stock > 0 ? `${v.stock} in stock` : "Sold out"}</Tag>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              <p className={styles.muted}>{`${plural(p.variants.reduce((s, v) => s + v.stock, 0), "item")} in stock in all.`}</p>
            </section>

            <TakeDown product={p} onDone={setProduct} />

            <div className={styles.actions}>
              <ButtonLink href={`/admin/stores/${p.business.id}`} variant="ghost" icon={<Icon name="store" size={18} />}>
                Open the shop
              </ButtonLink>
              {p.status === "live" && (
                <ButtonLink href={`/products/${p.id}`} variant="ghost" icon={<Icon name="bag" size={18} />}>
                  See it as customers do
                </ButtonLink>
              )}
              {canAudit && (
                <ButtonLink href={`/admin/audit?target=${p.id}`} variant="ghost" icon={<Icon name="clock" size={18} />}>
                  History for this product
                </ButtonLink>
              )}
            </div>
          </Card>
        )}
      </div>
    </Needs>
  );
}
