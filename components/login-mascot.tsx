"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Props = {
  mode: "password" | "otp";
  otpStep: number;
  loading: boolean;
  shake: boolean;
  error: string;
};

const hints = {
  password: "Welcome back! Pop in mobile + password.",
  otpSend: "No password? I'll ping you a code.",
  otpVerify: "Almost in — type the OTP!",
};

export function LoginMascot({ mode, otpStep, loading, shake, error }: Props) {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      setMouse({
        x: (e.clientX / window.innerWidth - 0.5) * 2,
        y: (e.clientY / window.innerHeight - 0.5) * 2,
      });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  const hint =
    mode === "password"
      ? hints.password
      : otpStep === 0
        ? hints.otpSend
        : hints.otpVerify;
  const showPhone = mode === "otp" && otpStep === 1;
  const eyeX = mouse.x * 4;
  const eyeY = mouse.y * 3;
  const tilt = mouse.x * 6;

  return (
    <div className="relative flex flex-col items-center justify-center">
      <div
        className={`signup-bubble mb-6 max-w-xs px-5 py-3 text-center text-sm ${error ? "signup-bubble-error" : "text-zinc-300"}`}
        key={`${mode}-${otpStep}-${error ? "e" : "ok"}`}
        role={error ? "alert" : undefined}
      >
        {loading ? "Checking the gate…" : error || hint}
        {error.toLowerCase().includes("sign up") && (
          <Link href="/signup" className="mt-2 block font-medium text-white underline-offset-2 hover:underline">
            Create account →
          </Link>
        )}
      </div>

      <div
        className={`signup-mascot-wrap float-y ${shake ? "signup-shake" : ""} ${loading ? "signup-loading" : ""}`}
      >
        <div style={{ transform: `rotate(${tilt}deg)` }} className="transition-transform duration-150">
          <svg
            viewBox="0 0 220 260"
            className="h-56 w-56 sm:h-64 sm:w-64 lg:h-72 lg:w-72"
            aria-hidden
          >
            <ellipse cx="110" cy="248" rx="52" ry="8" fill="rgba(255,255,255,0.08)" />

            <g className="signup-leg-left origin-[88px_200px]">
              <path d="M88 200 Q78 230 72 245" stroke="#e4e4e7" strokeWidth="8" fill="none" strokeLinecap="round" />
              <ellipse cx="70" cy="248" rx="14" ry="8" fill="#d4d4d8" />
            </g>
            <g className="signup-leg-right origin-[132px_200px]">
              <path d="M132 200 Q142 230 148 245" stroke="#e4e4e7" strokeWidth="8" fill="none" strokeLinecap="round" />
              <ellipse cx="150" cy="248" rx="14" ry="8" fill="#d4d4d8" />
            </g>

            <ellipse cx="110" cy="155" rx="58" ry="62" fill="url(#loginBodyGrad)" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
            <ellipse cx="98" cy="165" rx="22" ry="28" fill="rgba(255,255,255,0.12)" />

            {/* Ruxstar hat — text on the cap */}
            <g>
              <ellipse cx="110" cy="98" rx="54" ry="10" fill="#27272a" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
              <path d="M62 98 Q110 48 158 98 Z" fill="#3f3f46" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
              <path id="hatCurve" d="M74 96 Q110 76 146 96" fill="none" />
              <text fill="#fafafa" fontSize="10" fontWeight="bold" letterSpacing="1.2">
                <textPath href="#hatCurve" startOffset="50%" textAnchor="middle">
                  Ruxstar
                </textPath>
              </text>
            </g>

            <g className={!showPhone ? "signup-wave-arm origin-[58px_145px]" : ""}>
              <path d="M58 145 Q35 130 28 105" stroke="#e4e4e7" strokeWidth="7" fill="none" strokeLinecap="round" />
              <circle cx="26" cy="100" r="10" fill="#d4d4d8" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
            </g>

            <g className="signup-phone-arm origin-[162px_145px]">
              <path d="M162 145 Q185 135 192 115" stroke="#e4e4e7" strokeWidth="7" fill="none" strokeLinecap="round" />
              {showPhone ? (
                <g className="signup-phone-vibrate">
                  <rect x="183" y="88" width="26" height="42" rx="5" fill="#27272a" stroke="#fff" strokeWidth="1.5" />
                  <rect x="187" y="94" width="18" height="28" rx="2" fill="#52525b" />
                  <text x="196" y="112" textAnchor="middle" fill="#fbbf24" fontSize="8" fontWeight="bold" className="signup-otp-blink">*</text>
                </g>
              ) : (
                <circle cx="195" cy="108" r="10" fill="#d4d4d8" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
              )}
            </g>

            <g transform={`translate(${eyeX}, ${eyeY})`}>
              <ellipse cx="88" cy="138" rx="14" ry="16" fill="#18181b" />
              <ellipse cx="132" cy="138" rx="14" ry="16" fill="#18181b" />
              <circle cx="92" cy="134" r="5" fill="#fff" />
              <circle cx="136" cy="134" r="5" fill="#fff" />
              <circle cx="94" cy="135" r="2.5" fill="#18181b" />
              <circle cx="138" cy="135" r="2.5" fill="#18181b" />
            </g>

            {loading ? (
              <ellipse cx="110" cy="168" rx="8" ry="5" fill="#52525b" className="signup-mouth-think" />
            ) : error ? (
              <path d="M98 172 Q110 162 122 172" stroke="#52525b" strokeWidth="3" fill="none" strokeLinecap="round" />
            ) : (
              <path d="M96 165 Q110 180 124 165" stroke="#52525b" strokeWidth="3" fill="none" strokeLinecap="round" className="signup-smile" />
            )}

            <defs>
              <radialGradient id="loginBodyGrad" cx="40%" cy="35%">
                <stop offset="0%" stopColor="#fafafa" />
                <stop offset="100%" stopColor="#a1a1aa" />
              </radialGradient>
            </defs>
          </svg>
        </div>
      </div>
    </div>
  );
}
