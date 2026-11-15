"use client";

import { useRef, useState } from "react";
import { useOnSignedOut } from "@/components/social/session";
import { Button, useToast } from "@/components/ui";
import { formError } from "@/lib/api/account";
import type { NewCoupon } from "@/lib/api/admin";
import { keepIdempotencyKey, newIdempotencyKey } from "@/lib/api/client";
import { COUPON_MODULES, COUPON_WHERE, draftErrors, emptyDraft, newCouponOf, todayKey, type CouponModule } from "@/lib/coupons";
import { CouponFields } from "./CouponFields";
import styles from "./coupons.module.css";

interface NewCouponFormProps {
  /** `team` is someone making one for the shop they work at; it works there only. */
  who: "ruxstar" | "vendor" | "team";
  /** The vendor's businesses that take coupons. */
  shops?: { id: string; name: string }[];
  create: (body: NewCoupon & { businessIds?: string[] }, idempotencyKey: string) => Promise<{ code: string }>;
  onDone: () => void;
}

/**
 * Making a coupon: Ruxstar's from the console (for print orders, event tickets, coaching fees or any of them), a
 * vendor's for their own businesses, or one shop's from Work. Same as the app.
 */
export function NewCouponForm({ who, shops, create, onDone }: NewCouponFormProps) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const [draft, setDraft] = useState(() => ({ ...emptyDraft(), businessIds: shops?.length === 1 ? [shops[0]!.id] : [] }));
  const [modules, setModules] = useState<CouponModule[]>(["pod"]);
  const [busy, setBusy] = useState(false);
  const key = useRef(newIdempotencyKey());
  const errors = draftErrors(draft, { creating: true, needsShops: who === "vendor", today: todayKey() });
  const ready = Object.keys(errors).length === 0 && (who !== "ruxstar" || modules.length > 0);

  async function submit() {
    setBusy(true);
    try {
      const body = {
        ...newCouponOf(draft),
        ...(who === "vendor" ? { businessIds: draft.businessIds } : {}),
        ...(who === "ruxstar" ? { modules: COUPON_MODULES.filter((m) => modules.includes(m)) } : {}),
      };
      const made = await create(body, key.current);
      toast(`${made.code} is ready.`, "success");
      onDone();
    } catch (err) {
      if (!keepIdempotencyKey(err)) key.current = newIdempotencyKey();
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
      setBusy(false);
    }
  }

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        if (ready && !busy) void submit();
      }}
    >
      <p className={styles.muted}>
        {who === "ruxstar"
          ? "Ruxstar pays for the discount, at every business where it works. Businesses still get their full share."
          : who === "team"
            ? "It works at this shop only. The discount comes out of the shop's share, and Ruxstar's commission is on the price after it."
            : "You pay for the discount: it comes out of your share, and Ruxstar's commission is on the price after it."}
      </p>
      {who === "ruxstar" && (
        <div className={styles.group} role="group" aria-label="Works on">
          <span className={styles.label}>Works on</span>
          <div className={styles.chips}>
            {COUPON_MODULES.map((m) => {
              const on = modules.includes(m);
              return (
                <button key={m} type="button" className={styles.chip} aria-pressed={on} onClick={() => setModules(on ? modules.filter((x) => x !== m) : [...modules, m])}>
                  {COUPON_WHERE[m].charAt(0).toUpperCase() + COUPON_WHERE[m].slice(1)}
                </button>
              );
            })}
          </div>
          <p className={modules.length ? styles.hint : styles.error}>{modules.length ? "It can't change later." : "Pick at least one"}</p>
        </div>
      )}
      <CouponFields draft={draft} onChange={setDraft} errors={errors} creating canMoveStart shops={shops} />
      <div className={styles.actions}>
        <Button type="submit" size="lg" loading={busy} disabled={!ready}>
          Make coupon
        </Button>
      </div>
    </form>
  );
}
