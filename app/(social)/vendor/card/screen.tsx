"use client";

import { RuxstarCard } from "@/components/kyc/RuxstarCard";
import { Failed, Loading } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { getCard } from "@/lib/api/kyc";
import styles from "@/components/vendor/vendor.module.css";

/** The vendor's Ruxstar Card on its own. Every vendor has one, since identity approval opens the portal. Same as the app. */
export function VendorCardScreen() {
  const card = useLoad(getCard);

  if (card.error) return <Failed error={card.error} onRetry={card.reload} />;
  if (!card.data) return <Loading rows={2} />;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Ruxstar Card</h1>
      <div className={styles.memberCard}>
        <RuxstarCard card={card.data} />
        <p className={styles.muted}>Click the card to turn it over.</p>
        <p className={styles.muted}>Only you can see your masked Aadhaar and PAN. Others see the Verified tick on your profile and posts.</p>
      </div>
    </div>
  );
}
