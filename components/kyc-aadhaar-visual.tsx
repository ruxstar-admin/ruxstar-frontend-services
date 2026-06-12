"use client";

type Props = {
  active?: boolean;
};

function AadhaarLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden>
      <circle cx="20" cy="20" r="18" fill="#C0392B" fillOpacity="0.12" />
      <circle cx="20" cy="20" r="10" fill="#E74C3C" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <line
          key={deg}
          x1="20"
          y1="20"
          x2="20"
          y2="6"
          stroke="#E74C3C"
          strokeWidth="2"
          strokeLinecap="round"
          transform={`rotate(${deg} 20 20)`}
        />
      ))}
      <circle cx="20" cy="20" r="4.5" fill="#FDF2F0" />
    </svg>
  );
}

function QrPlaceholder() {
  return (
    <div className="grid h-[3.25rem] w-[3.25rem] grid-cols-5 grid-rows-5 gap-[2px] p-0.5" aria-hidden>
      {[
        1, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 1, 1, 0, 0, 1,
      ].map((on, i) => (
        <span
          key={i}
          className={`rounded-[1px] ${on ? "bg-zinc-800" : "bg-transparent"}`}
        />
      ))}
    </div>
  );
}

/** Realistic Aadhaar-style card with scan animation (demo/masked data only). */
export function KycAadhaarVisual({ active = false }: Props) {
  return (
    <div
      className={`relative mx-auto w-full max-w-[13.5rem] lg:mx-0 ${active ? "kyc-aadhaar-active" : ""}`}
      aria-hidden
    >
      <div className="relative overflow-hidden rounded-lg py-1">
        <div className="kyc-aadhaar-glow pointer-events-none absolute inset-0 rounded-2xl" />

        <div className="relative overflow-hidden rounded-lg border border-zinc-300/80 bg-[#fffef9] shadow-[0_8px_32px_rgba(0,0,0,0.45)]">
        {/* Tricolor — matches real Aadhaar card edge */}
        <div className="flex h-2 w-full">
          <span className="flex-[2] bg-[#FF9933]" />
          <span className="flex-1 bg-white" />
          <span className="flex-[2] bg-[#138808]" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-1.5 border-b border-zinc-200/80 bg-gradient-to-r from-[#fffef9] to-[#f8f4ea] px-2.5 py-1.5">
          <AadhaarLogo className="h-7 w-7 shrink-0" />
          <div className="min-w-0 leading-tight">
            <p className="text-[7px] font-semibold text-[#1a1a1a] sm:text-[8px]">
              भारत सरकार
            </p>
            <p className="text-[6.5px] font-medium text-zinc-600 sm:text-[7px]">
              Government of India
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-[9px] font-bold tracking-wide text-[#C0392B] sm:text-[10px]">
              आधार
            </p>
            <p className="text-[6px] font-semibold uppercase text-zinc-500">Aadhaar</p>
          </div>
        </div>

        {/* Body */}
        <div className="relative px-2.5 pb-2 pt-2">
          <div className="flex gap-2">
            {/* Photo */}
            <div className="relative h-[4.5rem] w-[3.4rem] shrink-0 overflow-hidden rounded-sm border border-zinc-300 bg-gradient-to-b from-zinc-100 to-zinc-200 sm:h-[5rem] sm:w-[3.75rem]">
              <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.03)_2px,rgba(0,0,0,0.03)_4px)]" />
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 60 80" aria-hidden>
                <ellipse cx="30" cy="28" rx="12" ry="14" fill="#94a3b8" fillOpacity="0.45" />
                <ellipse cx="30" cy="62" rx="18" ry="14" fill="#94a3b8" fillOpacity="0.35" />
              </svg>
              <div className="absolute bottom-0 left-0 right-0 bg-zinc-400/20 py-0.5 text-center text-[5px] font-medium text-zinc-600">
                PHOTO
              </div>
            </div>

            {/* Details */}
            <div className="min-w-0 flex-1 space-y-1 pt-0.5 text-[7px] text-zinc-800 sm:text-[7.5px]">
              <div>
                <p className="text-[6px] text-zinc-500">Name / नाम</p>
                <p className="truncate font-semibold tracking-wide">XXXXXX XXXXXX</p>
              </div>
              <div className="flex gap-3">
                <div>
                  <p className="text-[6px] text-zinc-500">DOB / जन्म तिथि</p>
                  <p className="font-medium">XX/XX/XXXX</p>
                </div>
                <div>
                  <p className="text-[6px] text-zinc-500">Gender / लिंग</p>
                  <p className="font-medium">X</p>
                </div>
              </div>
              <div className="pt-0.5">
                <p className="text-[6px] text-zinc-500">Aadhaar No.</p>
                <p className="font-mono text-[9px] font-bold tracking-[0.15em] text-[#1a1a1a] sm:text-[10px]">
                  XXXX XXXX XXXX
                </p>
              </div>
            </div>

            <QrPlaceholder />
          </div>

          {/* Footer tagline */}
          <div className="mt-2 flex items-center justify-between border-t border-dashed border-zinc-300/80 pt-1.5">
            <p className="text-[6px] font-medium text-zinc-500 sm:text-[6.5px]">
              मेरा आधार, मेरी पहचान
            </p>
            <span className="flex items-center gap-1 text-[6px] font-semibold text-emerald-700">
              <span className="kyc-aadhaar-pulse h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {active ? "Verifying…" : "Secure"}
            </span>
          </div>
        </div>

        {/* Scan beam */}
        <div className="kyc-aadhaar-scan pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-emerald-500/30 via-sky-400/15 to-transparent" />
        <div className="kyc-aadhaar-shimmer pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-transparent opacity-0" />
        </div>
      </div>

      {active && (
        <p className="mt-3 text-center text-[10px] font-medium text-emerald-300/90">
          Connecting to DigiLocker…
        </p>
      )}
    </div>
  );
}
