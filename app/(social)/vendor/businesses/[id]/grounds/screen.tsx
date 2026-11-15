"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ButtonLink, Icon, Skeleton, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { Back, Failed, Loading } from "@/components/vendor/parts";
import { useOnSignedOut } from "@/components/social/session";
import { businessGrounds, type VendorGround } from "@/lib/api/turf";
import { GROUND_STATUS } from "@/lib/turf";
import social from "@/components/social/social.module.css";
import styles from "@/components/vendor/vendor.module.css";

function GroundRow({ ground }: { ground: VendorGround }) {
  const status = GROUND_STATUS[ground.status];
  const courts = ground.courtList.length;
  return (
    <Link href={`/vendor/grounds/${ground.id}`} className={styles.row}>
      <Icon name="ball" size={20} />
      <span className={styles.rowText}>
        <span className={styles.rowTitle}>{ground.name}</span>
        <span className={styles.rowLine}>{`${ground.venue.city} · ${courts} ${courts === 1 ? "court" : "courts"}`}</span>
        <span className={styles.rowLine}>
          {ground.status === "draft"
            ? ground.missing.length
              ? `To do: ${ground.missing[0]}`
              : "Ready to publish"
            : `${ground.upcoming} ${ground.upcoming === 1 ? "booking" : "bookings"} to come`}
        </span>
      </span>
      <Tag tone={status.tone}>{status.label}</Tag>
      <Icon name="chevron-right" size={18} />
    </Link>
  );
}

/** A sports business's grounds, newest first, and the way to add one. */
export function BusinessGroundsScreen({ id }: { id: string }) {
  const onSignedOut = useOnSignedOut();
  const { items, loading, loadingMore, hasMore, error, more, reload } = usePages(() => businessGrounds(id));
  const sentinel = useNearEnd(more, hasMore && !error);
  const create = `/vendor/businesses/${id}/grounds/new`;

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  if (loading) return <Loading rows={3} />;
  if (error && !items.length) return <Failed error={error} onRetry={reload} />;

  return (
    <div className={styles.page}>
      <Back href={`/vendor/businesses/${id}`}>Business</Back>
      <div className={styles.head}>
        <h1 className={styles.title}>Grounds</h1>
        {items.length > 0 && (
          <ButtonLink href={create} icon={<Icon name="plus" size={18} />}>
            New ground
          </ButtonLink>
        )}
      </div>
      {items.length ? (
        <>
          <ul className={styles.rows}>
            {items.map((g) => (
              <li key={g.id}>
                <GroundRow ground={g} />
              </li>
            ))}
          </ul>
          {hasMore && <div ref={sentinel} className={social.sentinel} aria-hidden />}
          {loadingMore && <Skeleton height={72} radius={16} />}
        </>
      ) : (
        <Empty title="No grounds yet">
          <p>Add your ground, then its courts with their hours and prices. It’s a draft until you publish it.</p>
          <ButtonLink href={create} icon={<Icon name="plus" size={18} />}>
            New ground
          </ButtonLink>
        </Empty>
      )}
    </div>
  );
}
