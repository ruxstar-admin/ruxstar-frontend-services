"use client";

import { useState } from "react";
import { Icon, Input } from "@/components/ui";
import type { AppliedCoupon, CouponOffer } from "@/lib/api/orders";
import { money } from "@/lib/api/shops";
import { cleanCode } from "@/lib/coupons";
import styles from "./coupons.module.css";

interface CheckoutCouponsProps {
  /** Null until the order is priced. */
  offers: CouponOffer[] | null;
  applied: AppliedCoupon | null;
  discount: number;
  /** Why the code the customer tried can't be used. */
  problem: string | null;
  onApply: (code: string) => void;
  onRemove: () => void;
}

/** At checkout: the coupon on the order, a box for a code, and the offers the customer can pick. Same as the app. */
export function CheckoutCoupons({ offers, applied, discount, problem, onApply, onRemove }: CheckoutCouponsProps) {
  const [text, setText] = useState("");
  const others = (offers ?? []).filter((o) => o.code !== applied?.code);

  return (
    <div className={styles.checkout}>
      {applied ? (
        <div className={styles.offer} data-applied>
          <Icon name="ticket" size={20} />
          <span className={styles.offerText}>
            <span className={styles.offerTitle}>{`${applied.code} applied`}</span>
            <span className={styles.muted}>{`You save ${money(discount)} · ${applied.label}`}</span>
          </span>
          <button
            type="button"
            className={styles.link}
            onClick={() => {
              setText("");
              onRemove();
            }}
          >
            Remove
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (text) onApply(text);
          }}
        >
          <Input
            label="Coupon code"
            value={text}
            onChange={(e) => setText(cleanCode(e.target.value))}
            autoComplete="off"
            spellCheck={false}
            maxLength={16}
            error={problem ?? undefined}
            suffix={
              <button type="submit" className={styles.apply} disabled={!text}>
                Apply
              </button>
            }
          />
        </form>
      )}

      {others.map((offer) => (
        <button
          key={offer.code}
          type="button"
          className={styles.offer}
          disabled={!!offer.problem}
          onClick={() => {
            setText("");
            onApply(offer.code);
          }}
        >
          <Icon name="ticket" size={20} />
          <span className={styles.offerText}>
            <span className={styles.offerTitle}>{offer.label}</span>
            <span className={styles.hint}>{[offer.code, offer.fundedBy === "ruxstar" ? "Ruxstar offer" : "Shop offer", offer.terms].filter(Boolean).join(" · ")}</span>
            {offer.problem && <span className={styles.muted}>{offer.problem}</span>}
          </span>
          {!offer.problem && <span className={styles.save}>{`Save ${money(offer.discount)}`}</span>}
        </button>
      ))}
    </div>
  );
}
