"use client";

import { ButtonLink } from "@/components/ui";
import { useMe } from "@/components/social/session";
import styles from "../profile.module.css";

/** Your own profile gets an edit link; signed-out visitors get the invitation to join. */
export function ProfileActions({ ownerId }: { ownerId: string }) {
  const me = useMe();
  if (me === undefined) return null;
  if (me?.id === ownerId) {
    return (
      <ButtonLink href="/account" variant="secondary">
        Edit profile
      </ButtonLink>
    );
  }
  if (me) return null;
  return (
    <div className={styles.cta}>
      <p>Print, events, coaching and stays from the people around you.</p>
      <ButtonLink href="/signup" size="lg">
        Join Ruxstar
      </ButtonLink>
    </div>
  );
}
