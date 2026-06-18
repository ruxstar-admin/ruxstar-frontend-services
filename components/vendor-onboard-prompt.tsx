"use client";

import Link from "next/link";

function ShopMascot() {
  return (
    <svg
      viewBox="0 0 200 160"
      className="mx-auto h-36 w-44 sm:h-40 sm:w-48"
      aria-hidden
    >
      <ellipse cx="100" cy="148" rx="52" ry="8" fill="rgba(255,255,255,0.06)" />
      <path d="M38 72 L162 72 L148 52 L52 52 Z" fill="#34d399" fillOpacity="0.85" />
      <path d="M52 52 L148 52 L142 44 L58 44 Z" fill="#10b981" />
      <rect x="44" y="72" width="112" height="64" rx="6" fill="#18181b" stroke="rgba(255,255,255,0.12)" />
      <rect x="58" y="84" width="36" height="28" rx="4" fill="rgba(52,211,153,0.15)" stroke="rgba(52,211,153,0.35)" />
      <rect x="106" y="84" width="36" height="28" rx="4" fill="rgba(52,211,153,0.15)" stroke="rgba(52,211,153,0.35)" />
      <rect x="82" y="96" width="36" height="40" rx="4" fill="#27272a" stroke="rgba(255,255,255,0.1)" />
      <circle cx="110" cy="118" r="2.5" fill="#a1a1aa" />
      <circle cx="100" cy="34" r="22" fill="#fde68a" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
      <circle cx="92" cy="32" r="2.5" fill="#27272a" />
      <circle cx="108" cy="32" r="2.5" fill="#27272a" />
      <path d="M94 40 Q100 45 106 40" stroke="#27272a" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M78 28 Q100 14 122 28 L118 34 Q100 22 82 34 Z" fill="#38bdf8" />
      <path
        d="M122 38 Q140 28 148 18 Q150 14 146 12 Q138 18 124 32"
        fill="#fde68a"
        stroke="rgba(255,255,255,0.12)"
      />
      <rect x="68" y="58" width="64" height="14" rx="3" fill="#27272a" stroke="rgba(255,255,255,0.1)" />
      <text x="100" y="68" textAnchor="middle" fill="#34d399" fontSize="8" fontFamily="system-ui,sans-serif" fontWeight="600">
        OPEN
      </text>
    </svg>
  );
}

type Props = {
  onStart?: () => void;
  href?: string;
  compact?: boolean;
};

export function VendorOnboardPrompt({ onStart, href, compact = false }: Props) {
  return (
    <div className={`glass rounded-2xl text-center ${compact ? "p-6 sm:p-8" : "p-8 sm:p-10"}`}>
      <ShopMascot />
      <h2 className="mt-4 text-lg font-semibold text-zinc-100">Your shop&apos;s waiting</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-400">
        Turf, salon, clinic, store — pick a type and go live in a few minutes.
      </p>
      <div className="mt-6">
        {onStart ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onStart();
            }}
            className="btn-primary rounded-full px-6 py-2.5 text-sm font-semibold"
          >
            Onboard a business
          </button>
        ) : href ? (
          <Link
            href={href}
            className="btn-primary inline-block rounded-full px-6 py-2.5 text-sm font-semibold"
          >
            Onboard a business
          </Link>
        ) : null}
      </div>
    </div>
  );
}
