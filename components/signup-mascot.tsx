"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Props = {
  step: number;
  role: string;
  loading: boolean;
  shake: boolean;
  error: string;
};

const lines = [
  "Hey! Drop your mobile and I'll send a magic code!",
  "Psst… check your phone. Type the OTP before it melts!",
  "Pick your superpower & a password. Then we launch!",
];

export function SignupMascot({ step, role, loading, shake, error }: Props) {  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      setMouse({ x, y });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  const eyeX = mouse.x * 4;
  const eyeY = mouse.y * 3;
  const tilt = mouse.x * 6;

  return (
    <div className="relative flex flex-col items-center justify-center">
      <div
        className={`signup-bubble mb-6 max-w-xs px-5 py-3 text-center text-sm ${error ? "signup-bubble-error" : "text-zinc-300"}`}
        key={`bubble-${step}-${error ? "err" : "ok"}`}
        role={error ? "alert" : undefined}
      >
        {loading ? (
          "Hold on… I'm on it!"
        ) : error ? (
          <>
            {error}
            {error.includes("log in") && (
              <Link
                href="/login"
                className="mt-2 block font-medium text-white underline-offset-2 hover:underline"
              >
                Take me to login →
              </Link>
            )}
          </>
        ) : (
          lines[step]
        )}
      </div>
      <div
        key={`mascot-${step}`}
        className={`signup-mascot-wrap float-y signup-hop ${shake ? "signup-shake" : ""} ${loading ? "signup-loading" : ""}`}
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

          {/* body */}
          <ellipse cx="110" cy="155" rx="58" ry="62" fill="url(#bodyGrad)" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />

          {/* belly shine */}
          <ellipse cx="98" cy="165" rx="22" ry="28" fill="rgba(255,255,255,0.12)" />

          {/* role props — step 2 */}
          {step === 2 && role === "customer" && (
            <g className="signup-prop-pop">
              <rect x="158" y="130" width="28" height="32" rx="4" fill="#a1a1aa" stroke="#fff" strokeWidth="1.5" opacity="0.9" />
              <path d="M158 130 L172 118 L186 130" fill="none" stroke="#fff" strokeWidth="1.5" />
            </g>
          )}
          {step === 2 && role === "vendor" && (
            <g className="signup-prop-pop">
              <path d="M150 108 L110 88 L70 108 L70 125 L150 125 Z" fill="#71717a" stroke="#fff" strokeWidth="1.5" />
              <rect x="78" y="112" width="64" height="8" rx="2" fill="#fff" opacity="0.5" />
              <text x="110" y="120" textAnchor="middle" fill="#fff" fontSize="7" fontWeight="bold">SHOP</text>
            </g>
          )}
          {step === 2 && role === "delivery" && (
            <g className="signup-prop-pop">
              <ellipse cx="168" cy="148" rx="22" ry="14" fill="#52525b" stroke="#fff" strokeWidth="1.5" />
              <circle cx="152" cy="148" r="10" fill="#3f3f46" stroke="#fff" strokeWidth="1.5" />
              <circle cx="184" cy="148" r="10" fill="#3f3f46" stroke="#fff" strokeWidth="1.5" />
            </g>
          )}

          {/* left arm — waves on step 0 */}
          <g className={step === 0 ? "signup-wave-arm origin-[58px_145px]" : ""}>
            <path d="M58 145 Q35 130 28 105" stroke="#e4e4e7" strokeWidth="7" fill="none" strokeLinecap="round" />
            <circle cx="26" cy="100" r="10" fill="#d4d4d8" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
          </g>

          {/* right arm — phone on step 0/1 */}
          <g className={step <= 1 ? "signup-phone-arm origin-[162px_145px]" : ""}>
            <path d="M162 145 Q185 135 192 115" stroke="#e4e4e7" strokeWidth="7" fill="none" strokeLinecap="round" />
            {step <= 1 && (
              <g className={step === 1 ? "signup-phone-vibrate" : ""}>
                <rect x="183" y="88" width="26" height="42" rx="5" fill="#27272a" stroke="#fff" strokeWidth="1.5" />
                <rect x="187" y="94" width="18" height="28" rx="2" fill="#52525b" />
                {step === 1 && (
                  <>
                    <text x="196" y="108" textAnchor="middle" fill="#fbbf24" fontSize="8" fontWeight="bold" className="signup-otp-blink">*</text>
                    <text x="196" y="118" textAnchor="middle" fill="#fbbf24" fontSize="8" fontWeight="bold" className="signup-otp-blink" style={{ animationDelay: "0.2s" }}>*</text>
                    <text x="196" y="128" textAnchor="middle" fill="#fbbf24" fontSize="8" fontWeight="bold" className="signup-otp-blink" style={{ animationDelay: "0.4s" }}>*</text>
                  </>
                )}
                {step === 0 && (
                  <text x="196" y="112" textAnchor="middle" fill="#86efac" fontSize="6">SMS</text>
                )}
              </g>
            )}
            {step === 2 && (
              <circle cx="195" cy="108" r="10" fill="#d4d4d8" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
            )}
          </g>

          {/* face */}
          <g transform={`translate(${eyeX}, ${eyeY})`}>
            <ellipse cx="88" cy="138" rx="14" ry="16" fill="#18181b" />
            <ellipse cx="132" cy="138" rx="14" ry="16" fill="#18181b" />
            <circle cx="92" cy="134" r="5" fill="#fff" />
            <circle cx="136" cy="134" r="5" fill="#fff" />
            <circle cx="94" cy="135" r="2.5" fill="#18181b" />
            <circle cx="138" cy="135" r="2.5" fill="#18181b" />
          </g>

          {/* mouth */}
          {loading ? (
            <ellipse cx="110" cy="168" rx="8" ry="5" fill="#52525b" className="signup-mouth-think" />
          ) : !!error ? (
            <path d="M98 172 Q110 162 122 172" stroke="#52525b" strokeWidth="3" fill="none" strokeLinecap="round" />
          ) : (
            <path d="M96 165 Q110 180 124 165" stroke="#52525b" strokeWidth="3" fill="none" strokeLinecap="round" className="signup-smile" />
          )}

          {/* antenna / hair tuft */}
          <path d="M110 88 Q105 70 98 58" stroke="#e4e4e7" strokeWidth="4" fill="none" strokeLinecap="round" />
          <circle cx="96" cy="54" r="6" fill="#fafafa" className="signup-antenna-blink" />

          {/* step 1 orbiting dots */}
          {step === 1 && (
            <>
              <circle r="4" fill="#fbbf24" className="signup-orbit-a">
                <animateMotion dur="2s" repeatCount="indefinite" path="M110,95 A40,40 0 1,1 109,95" />
              </circle>
              <circle r="3" fill="#fff" className="signup-orbit-b">
                <animateMotion dur="2.8s" repeatCount="indefinite" path="M110,95 A55,55 0 1,0 111,95" />
              </circle>
            </>
          )}

          <defs>
            <radialGradient id="bodyGrad" cx="40%" cy="35%">
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
