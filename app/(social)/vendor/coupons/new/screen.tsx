"use client";

import { useRouter } from "next/navigation";
import { NewCouponForm } from "@/components/coupons/NewCouponForm";
import { ButtonLink } from "@/components/ui";
import { Back, Failed, Loading } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { createVendorCoupon, myBusinesses } from "@/lib/api/vendor";
import styles from "@/components/vendor/vendor.module.css";

export function NewVendorCouponScreen() {
  const router = useRouter();
  const businesses = useLoad(myBusinesses);

  if (businesses.error && !businesses.data) return <Failed error={businesses.error} onRetry={businesses.reload} />;
  if (!businesses.data) return <Loading rows={2} />;
  const shops = businesses.data.filter((b) => b.module === "pod").map((b) => ({ id: b.id, name: b.name }));

  return (
    <div className={styles.page}>
      <Back href="/vendor/coupons">Coupons</Back>
      <h1 className={styles.title}>New coupon</h1>
      {shops.length ? (
        <NewCouponForm
          who="vendor"
          shops={shops}
          create={(body, key) => createVendorCoupon({ ...body, businessIds: body.businessIds ?? [] }, key)}
          onDone={() => router.push("/vendor/coupons")}
        />
      ) : (
        <div className={styles.card}>
          <h2 className={styles.cardHead}>No print shop yet</h2>
          <p className={styles.muted}>Coupons work on print orders. Add a print shop first.</p>
          <div>
            <ButtonLink href="/vendor/businesses/new">Add a business</ButtonLink>
          </div>
        </div>
      )}
    </div>
  );
}
