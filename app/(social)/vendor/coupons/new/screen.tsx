"use client";

import { useRouter } from "next/navigation";
import { NewCouponForm } from "@/components/coupons/NewCouponForm";
import { ButtonLink } from "@/components/ui";
import { Back, Failed, Loading } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { createTeamCoupon, createVendorCoupon, myBusinesses } from "@/lib/api/vendor";
import styles from "@/components/vendor/vendor.module.css";

/** One shop's new coupon, from Work: it works at that shop only. */
function TeamCoupon({ placeId }: { placeId: string }) {
  const router = useRouter();
  const back = `/work/${placeId}/coupons`;
  return (
    <div className={styles.page}>
      <Back href={back}>Coupons</Back>
      <h1 className={styles.title}>New coupon</h1>
      <NewCouponForm who="team" create={(body, key) => createTeamCoupon(placeId, body, key)} onDone={() => router.push(back)} />
    </div>
  );
}

function VendorCoupon() {
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

/** A vendor's new coupon for their print shops, or with `placeId` one shop's from Work. Same as the app. */
export function NewVendorCouponScreen({ placeId }: { placeId?: string }) {
  return placeId ? <TeamCoupon placeId={placeId} /> : <VendorCoupon />;
}
