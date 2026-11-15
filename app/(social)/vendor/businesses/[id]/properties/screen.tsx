"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ButtonLink, Icon, Skeleton, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { Back, Failed, Loading } from "@/components/vendor/parts";
import { useOnSignedOut } from "@/components/social/session";
import { businessProperties, type VendorProperty } from "@/lib/api/stays";
import { KIND_LABEL, plural, PROPERTY_STATUS } from "@/lib/stays";
import social from "@/components/social/social.module.css";
import styles from "@/components/vendor/vendor.module.css";

function PropertyRow({ property }: { property: VendorProperty }) {
  const status = PROPERTY_STATUS[property.status];
  const beds = property.rooms.reduce((sum, r) => sum + r.beds, 0);
  return (
    <Link href={`/vendor/properties/${property.id}`} className={styles.row}>
      <Icon name="bed" size={20} />
      <span className={styles.rowText}>
        <span className={styles.rowTitle}>{property.name}</span>
        <span className={styles.rowLine}>{`${KIND_LABEL[property.kind]} · ${property.city} · ${plural(property.rooms.length, "room")}, ${plural(beds, "bed")}`}</span>
        <span className={styles.rowLine}>
          {property.status === "draft"
            ? property.missing.length
              ? `To do: ${property.missing[0]}`
              : "Ready to publish"
            : `${plural(property.staying, "tenant")} staying · ${property.upcoming} to move in`}
        </span>
      </span>
      <Tag tone={status.tone}>{status.label}</Tag>
      <Icon name="chevron-right" size={18} />
    </Link>
  );
}

/** A PG / hostel business's properties, newest first, and the way to add one. */
export function BusinessPropertiesScreen({ id }: { id: string }) {
  const onSignedOut = useOnSignedOut();
  const { items, loading, loadingMore, hasMore, error, more, reload } = usePages((cursor) => businessProperties(id, cursor));
  const sentinel = useNearEnd(more, hasMore && !error);
  const create = `/vendor/businesses/${id}/properties/new`;

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  if (loading) return <Loading rows={3} />;
  if (error && !items.length) return <Failed error={error} onRetry={reload} />;

  return (
    <div className={styles.page}>
      <Back href={`/vendor/businesses/${id}`}>Business</Back>
      <div className={styles.head}>
        <h1 className={styles.title}>Properties</h1>
        {items.length > 0 && (
          <ButtonLink href={create} icon={<Icon name="plus" size={18} />}>
            New property
          </ButtonLink>
        )}
      </div>
      {items.length ? (
        <>
          <ul className={styles.rows}>
            {items.map((p) => (
              <li key={p.id}>
                <PropertyRow property={p} />
              </li>
            ))}
          </ul>
          {hasMore && <div ref={sentinel} className={social.sentinel} aria-hidden />}
          {loadingMore && <Skeleton height={72} radius={16} />}
        </>
      ) : (
        <Empty title="No properties yet">
          <p>Add your PG or hostel, then its rooms with beds and prices. It’s a draft until you publish it.</p>
          <ButtonLink href={create} icon={<Icon name="plus" size={18} />}>
            New property
          </ButtonLink>
        </Empty>
      )}
    </div>
  );
}
