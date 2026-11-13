"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Needs } from "@/components/admin/AdminFrame";
import { styles } from "@/components/admin/parts";
import { NewCouponForm } from "@/components/coupons/NewCouponForm";
import { Icon } from "@/components/ui";
import { createCoupon } from "@/lib/api/admin";

export function NewCouponScreen() {
  const router = useRouter();
  return (
    <Needs need="coupons.manage">
      <div className={styles.page}>
        <Link href="/admin/coupons" className={styles.muted}>
          <Icon name="arrow-left" size={16} /> Coupons
        </Link>
        <h1 className={styles.title}>New Ruxstar coupon</h1>
        <NewCouponForm who="ruxstar" create={(body, key) => createCoupon(body, key)} onDone={() => router.push("/admin/coupons")} />
      </div>
    </Needs>
  );
}
