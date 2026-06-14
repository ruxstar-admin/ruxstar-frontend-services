"use client";

/**
 * /kyc/mobile-done
 * ─────────────────
 * Pure bridge page — no API calls here.
 *
 * Flow:
 *  1. DigiLocker completes → Cashfree redirects browser to this page
 *  2. This page immediately shows success + "Continue to Ruxstar" button
 *  3. User taps → deep-links back to the app (kyc/callback)
 *  4. callback.tsx in the app owns ALL sync logic (syncAadhaar + status polling)
 *
 * Why no sync here?
 *  - Browser fetch to backend hits CORS in some environments
 *  - The app's callback.tsx already handles sync reliably on first call
 *  - Double-syncing caused race conditions and false "not verified" reads
 */

import { useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

const ALLOWED_SCHEMES = [
  "ruxstarapplicationservices://",
  "exp://",
];

function isSafeAppUri(uri: string): boolean {
  return ALLOWED_SCHEMES.some((s) => uri.toLowerCase().startsWith(s));
}

function MobileDoneContent() {
  const searchParams = useSearchParams();

  const rawAppUri = searchParams.get("appUri") ?? "";
  const appUri = isSafeAppUri(rawAppUri)
    ? rawAppUri
    : "ruxstarapplicationservices://kyc/callback";

  const [opened,     setOpened]     = useState(false);
  const [linkFailed, setLinkFailed] = useState(false);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleContinue() {
    setOpened(true);
    window.location.href = appUri;
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    fallbackTimerRef.current = setTimeout(() => setLinkFailed(true), 2500);
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Icon — neutral, not a success tick */}
        <div style={{ ...styles.iconWrap, ...styles.iconBlue }}>
          <span style={{ fontSize: 30 }}>↩</span>
        </div>

        {/* Copy */}
        <div style={{ textAlign: "center" }}>
          <p style={styles.eyebrow}>KYC · In progress</p>
          <h1 style={styles.heading}>Return to the app to continue</h1>
          <p style={styles.sub}>
            Your DigiLocker session is complete. Head back to the Ruxstar app — it will confirm your details and guide you through the remaining steps.
          </p>
        </div>

        {/* Fallback hint */}
        {linkFailed && (
          <p style={styles.fallback}>
            The app didn&apos;t open automatically.{" "}
            <strong style={{ color: "#0A0A0F" }}>Close this page</strong> and
            reopen Ruxstar to complete the remaining steps.
          </p>
        )}

        {/* CTA */}
        <button
          onClick={handleContinue}
          disabled={opened && !linkFailed}
          style={{
            ...styles.btn,
            ...(opened && !linkFailed ? styles.btnLoading : {}),
          }}
        >
          {opened && !linkFailed ? "Opening Ruxstar…" : "Continue KYC in Ruxstar →"}
        </button>

        <p style={styles.note}>
          Your KYC is <strong style={{ color: "#AEAEB2" }}>not complete yet</strong> — the app will take care of the next steps.
          If it doesn&apos;t open, <strong style={{ color: "#6C6C70" }}>close this page</strong> to return.
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
            <div style={{ ...styles.iconWrap, ...styles.iconBlue }}>
              <span style={{ fontSize: 30 }}>↩</span>
            </div>
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
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
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
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 32,
  },
  iconGreen: {
    backgroundColor: "rgba(22,163,74,0.10)",
    border: "1px solid rgba(22,163,74,0.25)",
  },
  iconBlue: {
    backgroundColor: "rgba(99,102,241,0.10)",
    border: "1px solid rgba(99,102,241,0.25)",
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
