"use client";

/**
 * /kyc/mobile-done
 * ─────────────────
 * Landing page for the mobile Aadhaar KYC redirect.
 *
 * After DigiLocker completes, the backend redirects the user's browser here.
 * The mobile app embedded its live callback URL as ?appUri=<encoded-url>:
 *   • Expo Go    → exp://192.168.x.x:8081/--/kyc/callback
 *   • Production → ruxstarapplicationservices://kyc/callback
 *
 * The user sees a success screen and taps "Continue" to be sent back into
 * the exact right screen of the Ruxstar app.
 *
 * No authentication required — called by a browser redirect from the backend.
 */

import { useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

/**
 * Only allow known Ruxstar app URI schemes.
 * Prevents open-redirect abuse if someone crafts a malicious ?appUri=.
 *
 * exp://              — Expo Go (testing)
 * ruxstarapplicationservices:// — standalone production build
 */
const ALLOWED_SCHEMES = [
  "ruxstarapplicationservices://",
  "exp://",
];

function isSafeAppUri(uri: string): boolean {
  return ALLOWED_SCHEMES.some((scheme) => uri.toLowerCase().startsWith(scheme));
}

function MobileDoneContent() {
  const searchParams = useSearchParams();

  const rawAppUri = searchParams.get("appUri") ?? "";
  const appUri    = isSafeAppUri(rawAppUri)
    ? rawAppUri
    : "ruxstarapplicationservices://kyc/callback";

  const [opened,    setOpened]    = useState(false);
  const [linkFailed, setLinkFailed] = useState(false);

  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleContinue() {
    setOpened(true);

    // window.location.href never throws for unrecognised schemes — it just
    // silently does nothing. If the user is still on this page after 2 s,
    // the OS didn't handle the deep link, so we show the fallback message.
    window.location.href = appUri;

    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    fallbackTimerRef.current = setTimeout(() => setLinkFailed(true), 2000);
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>

        {/* Icon */}
        <div style={styles.iconWrap}>✅</div>

        {/* Heading */}
        <div style={{ textAlign: "center" }}>
          <p style={styles.eyebrow}>Step 1 · Aadhaar</p>
          <h1 style={styles.heading}>Verification complete</h1>
          <p style={styles.sub}>
            Your Aadhaar has been verified successfully. Tap below to continue
            your KYC inside the Ruxstar app.
          </p>
        </div>

        {/* Fallback message — shown only if deep link didn't open */}
        {linkFailed && (
          <p style={styles.fallback}>
            The app didn&apos;t open automatically.{" "}
            <strong style={{ color: "#0A0A0F" }}>Close this page</strong> to
            return to Ruxstar and continue.
          </p>
        )}

        {/* Primary CTA */}
        <button
          onClick={handleContinue}
          disabled={opened && !linkFailed}
          style={{
            ...styles.btn,
            ...(opened && !linkFailed ? styles.btnLoading : {}),
          }}
        >
          {opened && !linkFailed ? "Opening Ruxstar…" : "Continue to Ruxstar →"}
        </button>

        {/* Fallback note */}
        <p style={styles.note}>
          If the app doesn&apos;t open,{" "}
          <strong style={{ color: "#6C6C70" }}>close this page</strong> to
          return to Ruxstar and continue.
        </p>
      </div>

      <p style={styles.footer}>Ruxstar · Secure KYC powered by DigiLocker</p>
    </div>
  );
}

export default function KycMobileDonePage() {
  return (
    <Suspense
      fallback={
        <div style={styles.page}>
          <div style={styles.card}>
            <div style={styles.iconWrap}>🪪</div>
            <p style={styles.sub}>Loading…</p>
          </div>
        </div>
      }
    >
      <MobileDoneContent />
    </Suspense>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#ffffff",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#F5F5F7",
    borderRadius: 24,
    border: "1px solid #E5E5EA",
    padding: "40px 32px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 20,
    textAlign: "center",
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(22,163,74,0.10)",
    border: "1px solid rgba(22,163,74,0.25)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 32,
  },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    color: "#AEAEB2",
  },
  heading: {
    margin: "8px 0 0",
    fontSize: 22,
    fontWeight: 800,
    color: "#0A0A0F",
    letterSpacing: "-0.4px",
  },
  sub: {
    margin: "8px 0 0",
    fontSize: 14,
    color: "#6C6C70",
    lineHeight: 1.6,
  },
  fallback: {
    margin: 0,
    fontSize: 14,
    color: "#6C6C70",
    lineHeight: 1.6,
    backgroundColor: "rgba(245,158,11,0.08)",
    border: "1px solid rgba(245,158,11,0.25)",
    borderRadius: 12,
    padding: "12px 16px",
  },
  btn: {
    width: "100%",
    padding: "15px 24px",
    borderRadius: 999,
    border: "none",
    backgroundColor: "#7C3AED",
    color: "#ffffff",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    letterSpacing: "-0.1px",
    transition: "opacity 0.15s",
  },
  btnLoading: {
    opacity: 0.6,
    cursor: "default",
  },
  note: {
    margin: 0,
    fontSize: 12,
    color: "#AEAEB2",
    lineHeight: 1.6,
  },
  footer: {
    marginTop: 24,
    fontSize: 12,
    color: "#AEAEB2",
  },
};
