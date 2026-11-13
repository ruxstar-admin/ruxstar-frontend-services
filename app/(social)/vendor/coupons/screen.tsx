"use client";

import { useCallback, useEffect } from "react";
import { CouponCard } from "@/components/coupons/CouponCard";
import list from "@/components/coupons/coupons.module.css";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { ButtonLink, Icon, Skeleton } from "@/components/ui";
import { Back, Failed, Loading } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { myBusinesses, updateVendorCoupon, vendorCoupons } from "@/lib/api/vendor";
import styles from "@/components/vendor/vendor.module.css";

/** A vendor's coupons for their print shops: what each takes off, how often it's used, and changing them. Same as the app. */
export function VendorCouponsScreen() {
  const onSignedOut = useOnSignedOut();
  const businesses = useLoad(myBusinesses);
  const shops = (businesses.data ?? []).filter((b) => b.module === "pod").map((b) => ({ id: b.id, name: b.name }));
  const load = useCallback((cursor?: string) => vendorCoupons(cursor), []);
  const { items, setItems, loading, loadingMore, hasMore, error, more, reload } = usePages(load);
  const sentinel = useNearEnd(more, hasMore && !error);

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  if (loading) return <Loading rows={3} />;
  if (error && items.length === 0) return <Failed error={error} onRetry={reload} />;

  return (
    <div className={styles.page}>
      <Back href="/vendor">Dashboard</Back>
      <div className={styles.head}>
        <h1 className={styles.title}>Coupons</h1>
        <ButtonLink href="/vendor/coupons/new" icon={<Icon name="plus" size={16} />}>
          New coupon
        </ButtonLink>
      </div>
      <p className={styles.muted}>A coupon’s discount comes out of your share, and Ruxstar’s commission is on the price after it.</p>
      {items.length === 0 ? (
        <div className={styles.card}>
          <h2 className={styles.cardHead}>No coupons yet</h2>
          <p className={styles.muted}>Make one to bring customers to your print shops.</p>
        </div>
      ) : (
        <ul className={list.list}>
          {items.map((c) => (
            <CouponCard
              key={c.id}
              coupon={c}
              canEdit
              canSwitch
              shops={shops.length ? shops : undefined}
              save={(patch) => updateVendorCoupon(c.id, patch)}
              onSaved={(after) => setItems((now) => now.map((x) => (x.id === after.id ? after : x)))}
            />
          ))}
          {hasMore && <li ref={sentinel} aria-hidden />}
          {loadingMore && <Skeleton height={64} radius={16} />}
        </ul>
      )}
    </div>
  );
}
