"use client";

import Link from "next/link";
import { ButtonLink, Icon, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { Back, Failed, Loading } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { priceLine, shopDesk, vendorCatalog } from "@/lib/api/vendor";
import styles from "@/components/vendor/vendor.module.css";

/** Every product the shop prints, with its price or a "Set price" tag. Same as the app. `team` opens it from Work, by place id. */
export function PodPricesScreen({ id, team = false }: { id: string; team?: boolean }) {
  const home = shopDesk(team).home(id);
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
  if (!business.data || !catalog.data) return <Loading rows={4} />;
  const pod = business.data.pod;

  return (
    <div className={styles.page}>
      <Back href={home}>{business.data.name}</Back>
      <h1 className={styles.title}>Prices</h1>
      {!pod ? (
        <Empty title="Only print shops have prices" />
      ) : pod.products.length ? (
        <>
          <p className={styles.intro}>{pod.unpriced.length ? `${pod.unpriced.length} of ${pod.products.length} still need a price.` : "Every product has a price."}</p>
          <ul className={styles.rows}>
            {catalog.data.podProducts
              .filter((info) => pod.products.includes(info.id))
              .map((info) => (
                <li key={info.id}>
                  <Link href={`${home}/prices/${info.id}`} className={styles.row}>
                    <span className={styles.rowText}>
                      <span className={styles.rowTitle}>{info.label}</span>
                      <span className={styles.rowLine}>
                        {priceLine(pod.prices.find((p) => p.product === info.id)) ?? (info.pricing === "per_page" ? "Priced per page" : "Priced per unit")}
                      </span>
                    </span>
                    {pod.unpriced.includes(info.id) && <Tag tone="warning">Set price</Tag>}
                    <Icon name="chevron-right" size={18} />
                  </Link>
                </li>
              ))}
          </ul>
        </>
      ) : (
        <Empty title="No products yet">
          <p>Choose what you print first, then set a price for each.</p>
          <ButtonLink href={`${home}/products`} variant="secondary">
            Choose products
          </ButtonLink>
        </Empty>
      )}
    </div>
  );
}
