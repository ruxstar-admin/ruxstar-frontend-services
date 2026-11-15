"use client";

import { useEffect, useState } from "react";
import { Needs, useCan } from "@/components/admin/AdminFrame";
import { Failed, Fact, date, styles } from "@/components/admin/parts";
import { Avatar } from "@/components/profile/Avatar";
import { useOnSignedOut } from "@/components/social/session";
import { ButtonLink, Card, Icon, Skeleton, Tag } from "@/components/ui";
import { money } from "@/lib/api/shops";
import { consoleStore, type ConsoleStoreDetail } from "@/lib/api/store";
import { deliveryAreaLine, feeLine, methodsLine, plural, storeTypeLabel } from "@/lib/store";

/** One local shop for the Ruxstar team: how it sells, its counts, and where to go next. Suspending it is on its business page. */
export function StoreCaseScreen({ id }: { id: string }) {
  const onSignedOut = useOnSignedOut();
  const canAudit = useCan("audit.view");
  const canOrders = useCan("orders.view");
  const [detail, setDetail] = useState<ConsoleStoreDetail | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    consoleStore(id).then(
      (next) => live && setDetail(next),
      (err) => live && !onSignedOut(err) && setError(err),
    );
    return () => {
      live = false;
    };
  }, [id, attempt, onSignedOut]);

  const s = detail?.store;
  const setup = detail?.setup;

  return (
    <Needs need="businesses.view">
      <div className={styles.page}>
        <div>
          <ButtonLink href="/admin/stores" variant="ghost" icon={<Icon name="arrow-left" size={18} />}>
            Local shops
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
        ) : !detail || !s ? (
          <Skeleton height={420} radius={16} />
        ) : (
          <Card as="section" padding="lg" className={styles.page}>
            <div className={styles.head}>
              <div className={styles.row}>
                <Avatar name={s.name} url={s.photoUrl} size={56} />
                <div>
                  <h1 className={styles.title}>{s.name}</h1>
                  <p className={styles.muted}>{`${storeTypeLabel(s.type)} · ${[s.area, s.city].filter(Boolean).join(", ")}`}</p>
                </div>
              </div>
              <div className={styles.tags}>
                {s.suspended && <Tag tone="danger">Suspended</Tag>}
                {s.status === "draft" && <Tag>Draft</Tag>}
                <Tag tone={s.open ? "success" : "neutral"}>{s.open ? "Open" : "Closed"}</Tag>
              </div>
            </div>

            <dl className={styles.facts}>
              <Fact label="Products" value={plural(s.products, "product")} />
              <Fact label="Paid orders" value={String(s.orders)} />
              <Fact label="Open orders" value={String(detail.openOrders)} />
              <Fact label="Open returns" value={String(detail.openReturns)} warn={detail.openReturns > 0} />
              <Fact label="Returns" value={s.returnRule} />
              <Fact label="Added" value={date(s.createdAt)} />
              <Fact label="Shop id" value={s.id} />
            </dl>

            <section className={styles.group}>
              <h2 className={styles.subtitle}>How it sells</h2>
              {setup ? (
                <dl className={styles.facts}>
                  <Fact label="Ways to get it" value={methodsLine(setup)} warn={!setup.delivery && !setup.pickup} />
                  {setup.delivery && <Fact label="Delivers to" value={deliveryAreaLine(setup, s.city)} />}
                  {setup.delivery && <Fact label="Delivery fee" value={feeLine(setup.deliveryFee)} />}
                  <Fact label="Minimum order" value={setup.minOrder ? money(setup.minOrder) : "None"} />
                  {setup.notes && <Fact label="Notes" value={setup.notes} />}
                </dl>
              ) : (
                <p className={styles.muted}>The owner hasn’t set up delivery or pickup yet, so customers can’t order.</p>
              )}
            </section>

            <div className={styles.actions}>
              <ButtonLink href={`/admin/businesses/${s.id}`} variant="ghost" icon={<Icon name="store" size={18} />}>
                Open the business
              </ButtonLink>
              <ButtonLink href={`/admin/store-products?shop=${s.id}`} variant="ghost" icon={<Icon name="bag" size={18} />}>
                Its products
              </ButtonLink>
              {canOrders && (
                <ButtonLink href={`/admin/store-orders?shop=${s.id}`} variant="ghost" icon={<Icon name="receipt" size={18} />}>
                  Its orders
                </ButtonLink>
              )}
              <ButtonLink href={`/shops/${s.id}`} variant="ghost" icon={<Icon name="share" size={18} />}>
                See it as customers do
              </ButtonLink>
              {canAudit && (
                <ButtonLink href={`/admin/audit?target=${s.id}`} variant="ghost" icon={<Icon name="clock" size={18} />}>
                  History for this shop
                </ButtonLink>
              )}
            </div>
          </Card>
        )}
      </div>
    </Needs>
  );
}
