"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/profile/Avatar";
import { Empty } from "@/components/social/PostList";
import { InviteCard } from "@/components/team/InviteCard";
import { Icon, Tag } from "@/components/ui";
import { Failed, Loading } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { ACCESS, getWork, permissionsLine } from "@/lib/api/team";
import team from "@/components/team/team.module.css";
import styles from "@/components/vendor/vendor.module.css";

/** The Work area: team invites, and the businesses you help run. Same as the app. */
export function WorkScreen() {
  const { data, error, reload } = useLoad(() => getWork());
  const [note, setNote] = useState<string | null>(null);
  if (error && !data) return <Failed error={error} onRetry={reload} />;
  if (!data) return <Loading rows={2} />;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Work</h1>
      {note && <p className={team.success}>{note}</p>}
      {data.invites.length === 0 && data.places.length === 0 ? (
        <Empty title="No teams yet">
          <p>When a business owner invites you by your username, it shows up here.</p>
        </Empty>
      ) : (
        <>
          {data.invites.length > 0 && (
            <>
              <h2 className={team.section}>Invites</h2>
              {data.invites.map((invite) => (
                <InviteCard
                  key={invite.id}
                  invite={invite}
                  catalog={data.permissions}
                  onAnswered={(accepted) => {
                    setNote(accepted ? `You joined ${invite.business.name}'s team.` : "Invite declined.");
                    reload();
                  }}
                />
              ))}
            </>
          )}
          {data.places.length > 0 && (
            <>
              <h2 className={team.section}>Where you work</h2>
              <ul className={styles.rows}>
                {data.places.map((place) => {
                  const access = ACCESS[place.access];
                  return (
                    <li key={place.id}>
                      <Link href={`/work/${place.id}`} className={team.member}>
                        <Avatar name={place.business.name} url={place.business.photo} size={40} />
                        <span className={team.text}>
                          <span className={team.name}>{place.business.name}</span>
                          <span className={team.line}>{permissionsLine(data.permissions, place.permissions)}</span>
                        </span>
                        <Tag tone={access.tone}>{access.label}</Tag>
                        <Icon name="chevron-right" size={18} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
