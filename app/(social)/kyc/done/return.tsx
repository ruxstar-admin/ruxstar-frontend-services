"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, ButtonLink, Icon } from "@/components/ui";
import { formError, isSignedOut } from "@/lib/api/account";
import { checkAadhaar } from "@/lib/api/kyc";
import styles from "../../verify/verify.module.css";

type State = "checking" | "app" | "failed";

/**
 * Signed in on the website: check the Aadhaar and go back to Verification. Opened from the app,
 * this browser has no Ruxstar session, so it asks the person to return to the app, which checks.
 */
export function DigilockerReturn() {
  const router = useRouter();
  const [state, setState] = useState<State>("checking");
  const [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    checkAadhaar()
      .then(() => live && router.replace("/verify"))
      .catch((err) => {
        if (!live) return;
        if (isSignedOut(err)) return setState("app");
        setMessage(formError(err).message);
        setState("failed");
      });
    return () => {
      live = false;
    };
  }, [router, attempt]);

  return (
    <div className={styles.page}>
      <section className={styles.section} aria-live="polite">
        {state === "checking" && (
          <>
            <h1 className={styles.sectionTitle}>Checking your Aadhaar…</h1>
            <p className={styles.muted}>This takes a few seconds.</p>
          </>
        )}
        {state === "app" && (
          <>
            <h1 className={styles.sectionTitle}>
              <Icon name="check" size={22} /> Back to the Ruxstar app
            </h1>
            <p className={styles.muted}>Close this page and return to the app. It picks up your Aadhaar from there.</p>
            <div className={styles.actions}>
              <ButtonLink href="/signin?next=/verify" variant="ghost">
                Verifying on the website? Sign in
              </ButtonLink>
            </div>
          </>
        )}
        {state === "failed" && (
          <>
            <h1 className={styles.sectionTitle}>We could not check your Aadhaar</h1>
            <p className={styles.error}>{message}</p>
            <div className={styles.actions}>
              <ButtonLink href="/verify" variant="ghost">
                Back to verification
              </ButtonLink>
              <Button onClick={() => (setState("checking"), setAttempt((n) => n + 1))}>Try again</Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
