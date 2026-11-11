"use client";

import { ButtonLink } from "@/components/ui";
import { useMe } from "@/components/social/session";

/** Sits beside the username: an edit link on your own profile, an invitation to join for signed-out visitors. */
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
  return <ButtonLink href="/signup">Join Ruxstar</ButtonLink>;
}
