"use client";

import { Avatar } from "@/components/profile/Avatar";
import { Icon } from "@/components/ui";
import type { RuxstarCard as Card } from "@/lib/api/kyc";
import { QrCode } from "./QrCode";
import styles from "./kyc.module.css";

const since = new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

/** The member card. Masked numbers are for the owner only; the QR code opens the public profile. */
export function RuxstarCard({ card }: { card: Card }) {
  return (
    <figure className={styles.card} aria-label={`Ruxstar Card ${card.id}`}>
      <div className={styles.cardTop}>
        <span className="brand">
          <img src="/logo.svg" width={26} height={26} alt="" />
          <span>ruxstar</span>
        </span>
        <span className={styles.cardBadges}>
          <span className={styles.cardBadge}>
            <Icon name="verified" size={16} /> Verified
          </span>
          {card.vendor && (
            <span className={styles.cardBadge} data-tone="vendor">
              <Icon name="store" size={16} /> Vendor
            </span>
          )}
        </span>
      </div>

      <div className={styles.cardBody}>
        <Avatar name={card.name} url={card.photoUrl} size={64} />
        <div className={styles.cardWho}>
          <p className={styles.cardName}>{card.name}</p>
          <p className={styles.cardId}>{card.id}</p>
        </div>
      </div>

      <div className={styles.cardFoot}>
        <dl className={styles.cardFacts}>
          <div>
            <dt>Aadhaar</dt>
            <dd>{card.aadhaar}</dd>
          </div>
          {card.pan && (
            <div>
              <dt>PAN</dt>
              <dd>{card.pan}</dd>
            </div>
          )}
          <div>
            <dt>Member since</dt>
            <dd>{since.format(new Date(card.memberSince))}</dd>
          </div>
        </dl>
        <span className={styles.qr}>
          <QrCode value={card.profileUrl} size={96} label="QR code to your public profile" />
        </span>
      </div>
    </figure>
  );
}
