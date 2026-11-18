"use client";

import Link from "next/link";
import { Icon, Segmented } from "@/components/ui";
import { Avatar } from "@/components/profile/Avatar";
import type { FreelancerRef, GigPackage, GigTier } from "@/lib/api/gigs";
import { ratingLine, type Rating } from "@/lib/api/reviews";
import { money } from "@/lib/api/shops";
import { deliveryLine, sortedPackages, TIER_LABEL } from "@/lib/gigs";
import styles from "./gigs.module.css";

/** Who's behind a gig: photo, name, headline, city and rating. Opens their page. */
export function FreelancerRow({ freelancer, rating }: { freelancer: FreelancerRef; rating?: Rating }) {
  const stars = rating ? ratingLine(rating) : null;
  const lines = [freelancer.headline, [freelancer.city, stars].filter(Boolean).join(" · ")].filter(Boolean);
  return (
    <Link href={`/gigs/freelancer/${freelancer.businessId}`} className={styles.freelancer}>
      <Avatar name={freelancer.name} url={freelancer.avatarUrl} size={48} />
      <span className={styles.freelancerText}>
        <strong>{freelancer.name}</strong>
        {lines.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </span>
      <Icon name="chevron-right" size={18} />
    </Link>
  );
}

/** One package: its name and price, days and revisions, and what's included. */
export function PackageCard({ pack }: { pack: Pick<GigPackage, "name" | "price" | "deliveryDays" | "revisions" | "description"> }) {
  return (
    <div className={styles.package}>
      <div className={styles.packageHead}>
        <strong>{pack.name}</strong>
        <span className={styles.packagePrice}>{money(pack.price)}</span>
      </div>
      <span className={styles.packageLine}>{deliveryLine(pack)}</span>
      <p className={styles.packageText}>{pack.description}</p>
    </div>
  );
}

/** A gig's packages side by side as tabs, with the picked one's price, what's included, days and revisions. */
export function PackagePicker({ packages, tier, onChange }: { packages: readonly GigPackage[]; tier: GigTier; onChange: (tier: GigTier) => void }) {
  const sorted = sortedPackages(packages);
  const picked = sorted.find((p) => p.tier === tier) ?? sorted[0];
  if (!picked) return null;
  return (
    <>
      {sorted.length > 1 && <Segmented label="Package" options={sorted.map((p) => ({ value: p.tier, label: TIER_LABEL[p.tier] }))} value={picked.tier} onChange={onChange} />}
      <PackageCard pack={picked} />
    </>
  );
}
