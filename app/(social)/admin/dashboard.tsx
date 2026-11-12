"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useAccess } from "@/components/admin/AdminFrame";
import { Failed, styles } from "@/components/admin/parts";
import { useMe, useOnSignedOut } from "@/components/social/session";
import { Card, Icon, Skeleton, Tag, type IconName } from "@/components/ui";
import { getOverview, type Overview } from "@/lib/api/admin";
import { MODULE_LABEL } from "./modules/labels";

function Tile({ href, icon, label, number, children }: { href: string; icon: IconName; label: string; number: number; children: ReactNode }) {
  return (
    <Card as="article" interactive padding="lg">
      <Link href={href} className={styles.tile}>
        <span className={styles.tileHead}>
          <Icon name={icon} size={20} />
          {label}
        </span>
        <span className={styles.number}>{number.toLocaleString("en-IN")}</span>
        <span className={styles.muted}>{children}</span>
      </Link>
    </Card>
  );
}

export function Dashboard() {
  const me = useMe();
  const access = useAccess();
  const onSignedOut = useOnSignedOut();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    getOverview().then(
      (o) => live && setOverview(o),
      (err) => live && !onSignedOut(err) && setError(err),
    );
    return () => {
      live = false;
    };
  }, [attempt, onSignedOut]);

  const first = me?.name.split(" ")[0];

  return (
    <div className={styles.page}>
      <div>
        <h1 className={styles.title}>{first ? `Hi ${first}` : "Dashboard"}</h1>
        <p className={styles.muted}>
          {access.admin ? "You are an admin, so every section is open to you." : `Signed in as ${access.title ?? "Ruxstar staff"}.`}
        </p>
      </div>

      {error ? (
        <Failed
          error={error}
          onRetry={() => {
            setError(null);
            setAttempt((n) => n + 1);
          }}
        />
      ) : !overview ? (
        <div className={styles.tiles} aria-busy>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={156} radius={16} />
          ))}
        </div>
      ) : (
        <>
          <div className={styles.tiles}>
            {overview.kyc && (
              <Tile href="/admin/kyc" icon="verified" label="Verification to review" number={overview.kyc.waiting}>
                {overview.kyc.waiting === 0 ? "Nothing waiting." : "Identity checks waiting for a decision"}
              </Tile>
            )}
            {overview.businesses && (
              <Tile href="/admin/businesses" icon="store" label="Businesses" number={overview.businesses.total}>
                {overview.businesses.live} live
                {overview.businesses.suspended > 0 ? `, ${overview.businesses.suspended} on hold` : ""}
              </Tile>
            )}
            {overview.reports && (
              <Tile href="/admin/reports" icon="flag" label="Reported posts" number={overview.reports.posts}>
                {overview.reports.people > 0
                  ? `${overview.reports.people === 1 ? "1 person" : `${overview.reports.people} people`} reported too`
                  : overview.reports.posts === 0
                    ? "No open reports."
                    : `${overview.reports.reports} reports in all`}
              </Tile>
            )}
            {overview.users && (
              <Tile href="/admin/users" icon="user" label="People" number={overview.users.total}>
                {overview.users.newThisWeek} joined this week
                {overview.users.suspended > 0 ? `, ${overview.users.suspended} on hold` : ""}
              </Tile>
            )}
            {overview.staff && (
              <Tile href="/admin/staff" icon="shield" label="Ruxstar staff" number={overview.staff.active}>
                Active team members, not counting admins
              </Tile>
            )}
          </div>

          {overview.modules && (
            <Card as="section" padding="lg">
              <div className={styles.groupHead}>
                <h2 className={styles.subtitle}>Modules</h2>
                <Link href="/admin/modules" className={styles.muted}>
                  Settings
                </Link>
              </div>
              <div className={styles.tags}>
                {overview.modules.map((m) => (
                  <Tag key={m.module} tone={m.live ? "success" : "neutral"}>
                    {MODULE_LABEL[m.module]} · {m.live ? "Live" : "Off"}
                  </Tag>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
