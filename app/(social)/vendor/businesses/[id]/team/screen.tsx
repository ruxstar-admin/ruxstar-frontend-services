"use client";

import { ButtonLink, Icon } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { MemberRow } from "@/components/team/MemberRow";
import { Back, Failed, Loading } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { getTeam } from "@/lib/api/team";
import styles from "@/components/vendor/vendor.module.css";

/** The owner's team at one print shop: who works there, who is invited, and what each may do. Same as the app. */
export function TeamScreen({ id }: { id: string }) {
  const { data, error, reload } = useLoad(() => getTeam(id), id);
  if (error && !data) return <Failed error={error} onRetry={reload} />;
  if (!data) return <Loading rows={3} />;
  const full = data.members.length >= data.max;
  const quickStart = data.permissions.some((p) => !p.verify);
  const gate = data.permissions.some((p) => p.key === "tickets.scan");
  const coaches = data.permissions.some((p) => p.key === "classes.view");
  const groundStaff = data.permissions.some((p) => p.key === "turf.bookings");

  return (
    <div className={styles.page}>
      <Back href={`/vendor/businesses/${id}`}>Business</Back>
      <div className={styles.head}>
        <h1 className={styles.title}>Team</h1>
        {full ? (
          <span className={styles.muted}>Team is full ({data.max})</span>
        ) : (
          <ButtonLink href={`/vendor/businesses/${id}/team/invite`} icon={<Icon name="plus" size={18} />}>
            Invite someone
          </ButtonLink>
        )}
      </div>
      <p className={styles.intro}>
        {quickStart
          ? "Invite people by their Ruxstar username and choose what each can do. Gate keepers who only scan tickets can start once they accept; anything more waits until their identity verification (Aadhaar, PAN and a selfie) is approved."
          : "Invite people by their Ruxstar username and choose what each can do. Nothing works for them until their identity verification (Aadhaar, PAN and a selfie) is approved."}
      </p>
      {data.members.length ? (
        <>
          <p className={styles.muted}>
            {data.members.length} of {data.max} places used, invites included
          </p>
          <ul className={styles.rows}>
            {data.members.map((m) => (
              <li key={m.id}>
                <MemberRow member={m} catalog={data.permissions} href={`/vendor/businesses/${id}/team/${m.id}`} />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <Empty title="No one yet">
          <p>
            {gate
              ? "Invite gate keepers to scan tickets at your events."
              : coaches
                ? "Invite coaches to take attendance, message students and share notes for their batches."
                : groundStaff
                  ? "Invite ground staff to run the day’s board, block slots for maintenance or phone bookings, and mark who turned up."
                  : "Invite someone to help with orders, the shop or posts."}
          </p>
        </Empty>
      )}
    </div>
  );
}
