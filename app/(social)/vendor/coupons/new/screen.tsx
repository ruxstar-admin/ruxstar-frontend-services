"use client";

import { useRouter } from "next/navigation";
import { NewCouponForm } from "@/components/coupons/NewCouponForm";
import { ButtonLink } from "@/components/ui";
import { Back, Failed, Loading } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { createTeamCoupon, createVendorCoupon, myBusinesses } from "@/lib/api/vendor";
import { couponBusinesses } from "@/lib/coupons";
import { loadMyFreelancer } from "@/components/gigs/use-gigs";
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
  const shops = couponBusinesses(businesses.data);

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
          <h2 className={styles.cardHead}>No business for coupons yet</h2>
          <p className={styles.muted}>Coupons work on print orders, event tickets and coaching fees. Add a print shop, events or coaching business first.</p>
          <div>
            <ButtonLink href="/vendor/businesses/new">Add a business</ButtonLink>
          </div>
        </div>
      )}
    </div>
  );
}

/** A freelancer's new coupon for their gigs and offers, from Freelancing, for freelancers who aren't vendors. */
function FreelanceCoupon() {
  const router = useRouter();
  const me = useLoad(() => loadMyFreelancer().then((profile) => ({ profile })), "freelance");

  if (me.error && !me.data) return <Failed error={me.error} onRetry={me.reload} />;
  if (!me.data) return <Loading rows={2} />;
  const { profile } = me.data;

  return (
    <div className={styles.page}>
      <Back href="/freelance/coupons">Coupons</Back>
      <h1 className={styles.title}>New coupon</h1>
      {profile ? (
        <NewCouponForm
          who="vendor"
          shops={[{ id: profile.businessId, name: profile.name }]}
          create={(body, key) => createVendorCoupon({ ...body, businessIds: body.businessIds ?? [] }, key)}
          onDone={() => router.push("/freelance/coupons")}
        />
      ) : (
        <div className={styles.card}>
          <h2 className={styles.cardHead}>No freelancer profile</h2>
          <p className={styles.muted}>Start freelancing first.</p>
          <div>
            <ButtonLink href="/freelance">Freelancing</ButtonLink>
          </div>
        </div>
      )}
    </div>
  );
}

/** A vendor's new coupon for their businesses, a freelancer's for their gigs, or with `placeId` one shop's from Work. Same as the app. */
export function NewVendorCouponScreen({ placeId, freelance = false }: { placeId?: string; freelance?: boolean }) {
  if (freelance) return <FreelanceCoupon />;
  return placeId ? <TeamCoupon placeId={placeId} /> : <VendorCoupon />;
}
