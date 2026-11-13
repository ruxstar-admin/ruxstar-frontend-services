"use client";

import { useCallback, useEffect, useState } from "react";
import { Needs, useCan } from "@/components/admin/AdminFrame";
import { Failed, Rows, styles } from "@/components/admin/parts";
import { CouponCard } from "@/components/coupons/CouponCard";
import list from "@/components/coupons/coupons.module.css";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { ButtonLink, Icon, Input, Segmented, Skeleton } from "@/components/ui";
import { listCoupons, updateCoupon, type CouponFunder } from "@/lib/api/admin";
import { cleanCode } from "@/lib/coupons";

const TABS: { value: CouponFunder; label: string }[] = [
  { value: "ruxstar", label: "Ruxstar" },
  { value: "vendor", label: "Vendors" },
];

function Coupons({ funder, code }: { funder: CouponFunder; code: string | undefined }) {
  const onSignedOut = useOnSignedOut();
  const canManage = useCan("coupons.manage");
  const load = useCallback((cursor?: string) => listCoupons(funder, code, cursor), [funder, code]);
  const { items, setItems, loading, loadingMore, hasMore, error, more, reload } = usePages(load);
  const sentinel = useNearEnd(more, hasMore && !error);

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  if (loading) return <Rows />;
  if (error && items.length === 0) return <Failed error={error} onRetry={reload} />;
  if (items.length === 0) {
    return (
      <p className={styles.empty}>
        {code ? `No coupon ${code}.` : funder === "ruxstar" ? "No Ruxstar coupons yet. Ruxstar pays for these, at every print shop." : "No vendor coupons yet."}
      </p>
    );
  }

  return (
    <>
      {funder === "vendor" && !code && <p className={styles.note}>Vendors pay for their own coupons. You can switch one off if it is misused; only you can switch it back on.</p>}
      <ul className={list.list}>
        {items.map((c) => (
          <CouponCard
            key={c.id}
            coupon={c}
            canEdit={canManage && c.fundedBy === "ruxstar"}
            canSwitch={canManage}
            forTeam
            save={(patch) => updateCoupon(c.id, patch)}
            onSaved={(after) => setItems((now) => now.map((x) => (x.id === after.id ? after : x)))}
          />
        ))}
        {hasMore && <li ref={sentinel} aria-hidden />}
        {loadingMore && <Skeleton height={64} radius={16} />}
      </ul>
    </>
  );
}

/** Ruxstar's coupons, which Ruxstar pays for, and every vendor's, which the team can switch off. Same as the app. */
export function CouponsScreen() {
  const canManage = useCan("coupons.manage");
  const [funder, setFunder] = useState<CouponFunder>("ruxstar");
  const [text, setText] = useState("");
  const [code, setCode] = useState<string | undefined>();
  useEffect(() => {
    const t = setTimeout(() => setCode(text || undefined), 300);
    return () => clearTimeout(t);
  }, [text]);

  return (
    <Needs need="coupons.view">
      <div className={styles.page}>
        <div className={styles.head}>
          <h1 className={styles.title}>Coupons</h1>
          <Segmented label="Show" options={TABS} value={funder} onChange={setFunder} />
        </div>
        <div className={styles.toolbar}>
          <Input label="Find a code" placeholder="WELCOME20" value={text} onChange={(e) => setText(cleanCode(e.target.value))} autoComplete="off" spellCheck={false} />
          {canManage && funder === "ruxstar" && (
            <ButtonLink href="/admin/coupons/new" icon={<Icon name="plus" size={16} />}>
              New Ruxstar coupon
            </ButtonLink>
          )}
        </div>
        <Coupons key={`${funder}:${code ?? ""}`} funder={funder} code={code} />
      </div>
    </Needs>
  );
}
