"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui";
import styles from "./u/profile.module.css";

/** A signed-in page failed to load. The header stays, so people can go elsewhere or try again. */
export default function SocialError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className={styles.missing} role="alert">
      <h1 className={styles.missingTitle}>This page did not load</h1>
      <p className={styles.missingText}>It may be your connection, or a problem on our side. Try again in a moment.</p>
      <div className={styles.missingActions}>
        <Button onClick={reset}>Try again</Button>
        <ButtonLink href="/feed" variant="secondary">
          Go to feed
        </ButtonLink>
      </div>
    </div>
  );
}
