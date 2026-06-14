"use client";

/**
 * /kyc/mobile-done
 * ─────────────────
 * Landing page for the mobile Aadhaar KYC redirect.
 *
 * Flow:
 *  1. DigiLocker completes → Cashfree redirects browser here
 *  2. This page reads ?token= and calls the backend sync API (same as /kyc/done)
 *  3. Shows a spinner while polling until Aadhaar is confirmed
 *  4. Only then shows "Continue to Ruxstar →" — user taps, app opens
 *  5. App reads /vendor/kyc/status (already verified) → navigates to PAN
 *
 * Why sync here instead of in the app?
 *  - The browser session has the token; this mirrors exactly what /kyc/done does
 *  - App callback becomes a simple single status read (no polling needed)
 *  - User sees clear progress before being sent back to the app
 */

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

// ─── Config ───────────────────────────────────────────────────────────────────

const BACKEND_URL    = "https://ruxstar-backend-services-391710984982.us-central1.run.app";
const MAX_ATTEMPTS   = 8;
const POLL_MS        = 2500;
const INITIAL_DELAY  = 1500;

const ALLOWED_SCHEMES = [
  "ruxstarapplicationservices://",
  "exp://",
];

function isSafeAppUri(uri: string): boolean {
  return ALLOWED_SCHEMES.some((s) => uri.toLowerCase().startsWith(s));
}

// ─── Backend calls (no auth library needed — plain fetch with Bearer token) ──

async function callSync(token: string): Promise<void> {
  await fetch(`${BACKEND_URL}/vendor/kyc/aadhaar/sync`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function fetchKycStatus(token: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${BACKEND_URL}/vendor/kyc/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json() as Record<string, unknown>;
  // Unwrap { kyc: { ... } } envelope that the backend wraps responses in
  const kyc = (data?.kyc && typeof data.kyc === "object")
    ? data.kyc as Record<string, unknown>
    : data;
  return kyc;
}

function isAadhaarDone(kyc: Record<string, unknown> | null): boolean {
  const a = kyc?.aadhaar as Record<string, unknown> | undefined;
  return a?.status === "verified" || a?.verified === true;
}

// ─── Phase types ──────────────────────────────────────────────────────────────

type Phase = "syncing" | "done" | "failed" | "no-token";

// ─── Main content ─────────────────────────────────────────────────────────────

function MobileDoneContent() {
  const searchParams = useSearchParams();

  const rawAppUri = searchParams.get("appUri") ?? "";
  const token     = searchParams.get("token")  ?? "";

  const appUri = isSafeAppUri(rawAppUri)
    ? rawAppUri
    : "ruxstarapplicationservices://kyc/callback";

  const [phase,      setPhase]      = useState<Phase>(token ? "syncing" : "no-token");
  const [attempt,    setAttempt]    = useState(0);
  const [opened,     setOpened]     = useState(false);
  const [linkFailed, setLinkFailed] = useState(false);

  const calledRef      = useRef(false);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Sync polling (only when token is present) ─────────────────────────────
  useEffect(() => {
    if (!token || calledRef.current) return;
    calledRef.current = true;

    (async () => {
      // 1. Initial settle delay — Cashfree needs time to process DigiLocker callback
      await new Promise<void>((r) => setTimeout(r, INITIAL_DELAY));

      // 2. Poll until Aadhaar verified
      for (let i = 1; i <= MAX_ATTEMPTS; i++) {
        setAttempt(i);
        try {
          await callSync(token);
          const kyc = await fetchKycStatus(token);
          if (isAadhaarDone(kyc)) {
            setPhase("done");
            return;
          }
        } catch {
          // swallow — keep polling
        }
        if (i < MAX_ATTEMPTS) {
          await new Promise<void>((r) => setTimeout(r, POLL_MS));
        }
      }

      // 3. Exhausted — let user continue anyway; app will handle edge case
      setPhase("failed");
    })();
  }, [token]);

  // ── Deep-link handler ─────────────────────────────────────────────────────
  function handleContinue() {
    setOpened(true);
    window.location.href = appUri;
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    fallbackTimerRef.current = setTimeout(() => setLinkFailed(true), 2000);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  // SYNCING — show spinner + attempt count
  if (phase === "syncing") {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ ...styles.iconWrap, ...styles.iconWrapPurple }}>
            <div style={styles.spinner} />
          </div>
          <div style={{ textAlign: "center" }}>
            <p style={styles.eyebrow}>Step 1 · Aadhaar</p>
            <h1 style={styles.heading}>Verifying with DigiLocker</h1>
            <p style={styles.sub}>
              {attempt === 0
                ? "Connecting to DigiLocker…"
                : `Confirming your identity… (${attempt}/${MAX_ATTEMPTS})`}
            </p>
          </div>
          <p style={styles.note}>Please keep this page open</p>
        </div>
        <p style={styles.footer}>Ruxstar · Secure KYC powered by DigiLocker</p>
        <style>{spinnerCSS}</style>
      </div>
    );
  }

  // FAILED — sync exhausted, still let them continue (app has retry logic too)
  if (phase === "failed") {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ ...styles.iconWrap, ...styles.iconWrapAmber }}>
            <span style={{ fontSize: 30 }}>↩</span>
          </div>
          <div style={{ textAlign: "center" }}>
            <p style={styles.eyebrow}>Step 1 · Aadhaar</p>
            <h1 style={styles.heading}>Sync taking longer</h1>
            <p style={styles.sub}>
              DigiLocker is still processing. Continue to the app — it will check again automatically.
            </p>
          </div>
          {linkFailed && <p style={styles.fallback}>The app didn&apos;t open. <strong>Close this page</strong> to return to Ruxstar.</p>}
          <button onClick={handleContinue} disabled={opened && !linkFailed} style={{ ...styles.btn, ...(opened && !linkFailed ? styles.btnLoading : {}) }}>
            {opened && !linkFailed ? "Opening Ruxstar…" : "Continue to Ruxstar →"}
          </button>
          <p style={styles.note}>The app will retry verification automatically</p>
        </div>
        <p style={styles.footer}>Ruxstar · Secure KYC powered by DigiLocker</p>
      </div>
    );
  }

  // DONE or NO-TOKEN — show success + continue button
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={{ ...styles.iconWrap, ...styles.iconWrapGreen }}>
          <span style={{ fontSize: 30 }}>✓</span>
        </div>
        <div style={{ textAlign: "center" }}>
          <p style={styles.eyebrow}>Step 1 · Aadhaar</p>
          <h1 style={styles.heading}>
            {phase === "done" ? "Aadhaar verified!" : "Verification complete"}
          </h1>
          <p style={styles.sub}>
            {phase === "done"
              ? "Your Aadhaar has been confirmed. Tap below to continue your KYC inside Ruxstar."
              : "Your Aadhaar has been verified successfully. Tap below to continue your KYC inside the Ruxstar app."}
          </p>
        </div>
        {linkFailed && (
          <p style={styles.fallback}>
            The app didn&apos;t open automatically.{" "}
            <strong style={{ color: "#0A0A0F" }}>Close this page</strong> to return to Ruxstar and continue.
          </p>
        )}
        <button
          onClick={handleContinue}
          disabled={opened && !linkFailed}
          style={{ ...styles.btn, ...(opened && !linkFailed ? styles.btnLoading : {}) }}
        >
          {opened && !linkFailed ? "Opening Ruxstar…" : "Continue to Ruxstar →"}
        </button>
        <p style={styles.note}>
          If the app doesn&apos;t open, <strong style={{ color: "#6C6C70" }}>close this page</strong> to return to Ruxstar and continue.
        </p>
      </div>
      <p style={styles.footer}>Ruxstar · Secure KYC powered by DigiLocker</p>
    </div>
  );
}

// ─── Page export ─────────────────────────────────────────────────────────────

export default function KycMobileDonePage() {
  return (
    <Suspense
      fallback={
        <div style={styles.page}>
          <div style={styles.card}>
            <div style={{ ...styles.iconWrap, ...styles.iconWrapPurple }}>
              <div style={styles.spinner} />
            </div>
            <p style={styles.sub}>Loading…</p>
          </div>
          <style>{spinnerCSS}</style>
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
    fontWeight: 700,
  },
  iconWrapGreen: {
    backgroundColor: "rgba(22,163,74,0.10)",
    border: "1px solid rgba(22,163,74,0.25)",
    color: "#16a34a",
  },
  iconWrapPurple: {
    backgroundColor: "rgba(124,58,237,0.10)",
    border: "1px solid rgba(124,58,237,0.25)",
  },
  iconWrapAmber: {
    backgroundColor: "rgba(245,158,11,0.10)",
    border: "1px solid rgba(245,158,11,0.25)",
    color: "#d97706",
  },
  spinner: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    border: "3px solid rgba(124,58,237,0.20)",
    borderTopColor: "#7C3AED",
    animation: "spin 0.8s linear infinite",
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

const spinnerCSS = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;
