"use client";

type Props = {
  active?: boolean;
  panPreview?: string;
};

function ItdEmblem({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 36 36" fill="none" aria-hidden>
      <circle cx="18" cy="18" r="16" fill="#1e3a5f" fillOpacity="0.12" />
      <circle cx="18" cy="18" r="11" stroke="#1e40af" strokeWidth="1.5" fill="#eff6ff" />
      <circle cx="18" cy="18" r="4" fill="#1e40af" />
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
        <line
          key={deg}
          x1="18"
          y1="18"
          x2="18"
          y2="8"
          stroke="#1e40af"
          strokeWidth="1"
          strokeLinecap="round"
          transform={`rotate(${deg} 18 18)`}
        />
      ))}
    </svg>
  );
}

/** Realistic PAN card visual with scan animation (demo/masked data). */
export function KycPanVisual({ active = false, panPreview }: Props) {
  const pan =
    panPreview && panPreview.length === 10
      ? `${panPreview.slice(0, 5)}${panPreview.slice(5, 9)}${panPreview.slice(9)}`
      : "XXXXX0000X";

  return (
    <div
      className={`relative mx-auto w-full max-w-[15.5rem] sm:max-w-[17rem] ${active ? "kyc-aadhaar-active" : ""}`}
      aria-hidden
    >
      <div className="kyc-aadhaar-glow absolute -inset-4 rounded-2xl" />

      <div className="relative overflow-hidden rounded-lg border border-blue-200/90 bg-gradient-to-br from-[#e8f0fa] via-[#f0f6fc] to-[#dce8f5] shadow-[0_8px_32px_rgba(0,0,0,0.45)]">
        {/* Top band */}
        <div className="bg-gradient-to-r from-[#1e3a8a] to-[#1d4ed8] px-2.5 py-1.5">
          <div className="flex items-center gap-1.5">
            <ItdEmblem className="h-6 w-6 shrink-0 rounded-full bg-white/90 p-0.5" />
            <div className="min-w-0 leading-tight text-white">
              <p className="text-[7px] font-bold sm:text-[8px]">आयकर विभाग</p>
              <p className="text-[6px] font-medium opacity-90 sm:text-[7px]">
                Income Tax Department
              </p>
            </div>
          </div>
        </div>

        <div className="px-2.5 py-1 text-center">
          <p className="text-[6.5px] font-semibold uppercase tracking-wider text-blue-900/70">
            Permanent Account Number Card
          </p>
        </div>

        <div className="relative px-2.5 pb-2.5">
          <div className="flex gap-2">
            <div className="relative h-[3.75rem] w-[2.85rem] shrink-0 overflow-hidden rounded-sm border border-blue-200 bg-white sm:h-[4.25rem] sm:w-[3.1rem]">
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 50 70" aria-hidden>
                <ellipse cx="25" cy="24" rx="10" ry="12" fill="#64748b" fillOpacity="0.4" />
                <ellipse cx="25" cy="54" rx="14" ry="11" fill="#64748b" fillOpacity="0.3" />
              </svg>
              <div className="absolute bottom-0 left-0 right-0 bg-blue-100/80 py-0.5 text-center text-[5px] font-medium text-blue-800">
                PHOTO
              </div>
            </div>

            <div className="min-w-0 flex-1 space-y-1 text-[7px] text-slate-800 sm:text-[7.5px]">
              <div>
                <p className="text-[6px] text-slate-500">Name</p>
                <p className="truncate font-semibold">XXXXXX XXXXXX</p>
              </div>
              <div>
                <p className="text-[6px] text-slate-500">Father&apos;s Name</p>
                <p className="truncate font-medium">XXXXXX XXXXXX</p>
              </div>
              <div>
                <p className="text-[6px] text-slate-500">Date of Birth</p>
                <p className="font-medium">XX/XX/XXXX</p>
              </div>
            </div>
          </div>

          <div className="mt-2 rounded-md border border-blue-300/60 bg-white/70 px-2 py-1.5 text-center">
            <p className="text-[6px] font-semibold uppercase tracking-widest text-blue-800/70">
              Permanent Account Number
            </p>
            <p className="font-mono text-[11px] font-bold tracking-[0.2em] text-[#1e3a8a] sm:text-xs">
              {pan.slice(0, 5)}
              <span className="text-blue-600">{pan.slice(5, 9)}</span>
              {pan.slice(9)}
            </p>
          </div>

          <div className="mt-1.5 flex items-center justify-between border-t border-dashed border-blue-200 pt-1.5">
            <p className="text-[6px] font-medium text-slate-500">Govt. of India</p>
            <span className="flex items-center gap-1 text-[6px] font-semibold text-blue-700">
              <span className="kyc-aadhaar-pulse h-1.5 w-1.5 rounded-full bg-blue-500" />
              {active ? "Verifying…" : "Valid"}
            </span>
          </div>
        </div>

        <div className="kyc-aadhaar-scan pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-blue-500/25 via-sky-400/12 to-transparent" />
        <div className="kyc-aadhaar-shimmer pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/50 to-transparent opacity-0" />
      </div>

      {active && (
        <p className="mt-3 text-center text-[10px] font-medium text-blue-300/90">
          Verifying with ITD…
        </p>
      )}
    </div>
  );
}
