"use client";

import { useRef, useState } from "react";
import { useOnSignedOut } from "@/components/social/session";
import { Button, useToast } from "@/components/ui";
import { formError } from "@/lib/api/account";
import type { NewCoupon } from "@/lib/api/admin";
import { ApiError, newIdempotencyKey } from "@/lib/api/client";
import { draftErrors, emptyDraft, newCouponOf, todayKey } from "@/lib/coupons";
import { CouponFields } from "./CouponFields";
import styles from "./coupons.module.css";

interface NewCouponFormProps {
  who: "ruxstar" | "vendor";
  /** The vendor's print shops. */
  shops?: { id: string; name: string }[];
  create: (body: NewCoupon & { businessIds?: string[] }, idempotencyKey: string) => Promise<{ code: string }>;
  onDone: () => void;
}

const retryable = (err: unknown) => err instanceof ApiError && err.status === 0;

/** Making a coupon: Ruxstar's from the console, or a vendor's for their own print shops. Same as the app. */
export function NewCouponForm({ who, shops, create, onDone }: NewCouponFormProps) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const [draft, setDraft] = useState(() => ({ ...emptyDraft(), businessIds: shops?.length === 1 ? [shops[0]!.id] : [] }));
  const [busy, setBusy] = useState(false);
  const key = useRef(newIdempotencyKey());
  const errors = draftErrors(draft, { creating: true, needsShops: who === "vendor", today: todayKey() });
  const ready = Object.keys(errors).length === 0;

  async function submit() {
    setBusy(true);
    try {
      const body = { ...newCouponOf(draft), ...(who === "vendor" ? { businessIds: draft.businessIds } : {}) };
      const made = await create(body, key.current);
      toast(`${made.code} is ready.`, "success");
      onDone();
    } catch (err) {
      if (!retryable(err)) key.current = newIdempotencyKey();
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
          ? "Ruxstar pays for the discount, at every print shop. Shops still get their full share."
          : "You pay for the discount: it comes out of your share, and Ruxstar's commission is on the price after it."}
      </p>
      <CouponFields draft={draft} onChange={setDraft} errors={errors} creating canMoveStart shops={shops} />
      <div className={styles.actions}>
        <Button type="submit" size="lg" loading={busy} disabled={!ready}>
          Make coupon
        </Button>
      </div>
    </form>
  );
}
