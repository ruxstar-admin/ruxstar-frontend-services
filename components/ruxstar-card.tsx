"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RuxstarCardData } from "@/lib/api";

type Props = {
  card: RuxstarCardData;
};

type Tilt = { x: number; y: number };

function formatMemberSince(value: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d
    .toLocaleDateString("en-IN", { month: "short", year: "2-digit" })
    .replace(" ", " '")
    .toUpperCase();
}

function tiltFromPoint(rect: DOMRect, clientX: number, clientY: number, maxTilt = 16): Tilt {
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  const clampedX = Math.min(1, Math.max(0, x));
  const clampedY = Math.min(1, Math.max(0, y));

  return {
    x: (0.5 - clampedY) * maxTilt,
    y: (clampedX - 0.5) * maxTilt,
  };
}

export function RuxstarCard({ card }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState<Tilt>({ x: 0, y: 0 });
  const [active, setActive] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [motionEnabled, setMotionEnabled] = useState(true);

  const holderName = (card.name ?? "Verified Member").toUpperCase();
  const memberSince = formatMemberSince(card.memberSince);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setMotionEnabled(!mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const applyPointer = useCallback(
    (clientX: number, clientY: number) => {
      const el = stageRef.current;
      if (!el || !motionEnabled) return;
      setTilt(tiltFromPoint(el.getBoundingClientRect(), clientX, clientY));
      setActive(true);
    },
    [motionEnabled],
  );

  const resetPointer = useCallback(() => {
    setTilt({ x: 0, y: 0 });
    setActive(false);
  }, []);

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      applyPointer(e.clientX, e.clientY);
    },
    [applyPointer],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      const touch = e.touches[0];
      if (!touch) return;
      applyPointer(touch.clientX, touch.clientY);
    },
    [applyPointer],
  );

  const shadowX = tilt.y * 1.2;
  const shadowY = 20 - tilt.x * 0.6;

  return (
    <div
      ref={stageRef}
      className={`ruxcard-stage ${revealed && !active && motionEnabled ? "ruxcard-stage-idle" : ""}`}
      onMouseMove={onMouseMove}
      onMouseLeave={resetPointer}
      onTouchStart={onTouchMove}
      onTouchMove={onTouchMove}
      onTouchEnd={resetPointer}
    >
      <div
        className={`ruxcard-tilt ${revealed ? "" : "ruxcard-reveal"}`}
        onAnimationEnd={() => setRevealed(true)}
        style={{
          transform: motionEnabled
            ? `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${active ? 1.02 : 1})`
            : undefined,
          transition: active
            ? "transform 0.12s ease-out"
            : "transform 0.65s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <div
          className="ruxcard relative aspect-[1.586/1] w-full overflow-hidden rounded-2xl border border-white/[0.09] bg-[#111110] p-0"
          style={{
            boxShadow: motionEnabled
              ? `${shadowX}px ${shadowY}px 48px -20px rgba(0,0,0,0.5)`
              : "0 20px 40px -24px rgba(0,0,0,0.45)",
          }}
        >
          <div className="relative h-full w-full overflow-hidden rounded-2xl">
            <div className="absolute inset-0 bg-gradient-to-br from-[#161514] via-[#111110] to-[#0e0e0d]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_0%_0%,rgba(212,196,168,0.07),transparent_55%),radial-gradient(ellipse_at_100%_100%,rgba(255,255,255,0.04),transparent_50%)]" />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(160deg,rgba(255,255,255,0.03)_0%,transparent_40%,rgba(212,196,168,0.04)_100%)]" />

          <div className="relative flex h-full flex-col justify-between p-5 sm:p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs leading-none text-[#c4b49a]/80">★</span>
                  <p className="text-sm font-medium uppercase tracking-[0.28em] text-zinc-100">
                    Ruxstar
                  </p>
                </div>
                <p className="mt-1.5 text-[9px] uppercase tracking-[0.26em] text-zinc-500">
                  Verified Member
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[9px] font-medium uppercase tracking-wider text-[#c4b49a]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#c4b49a]/70" />
                Verified
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-7 w-10 rounded-md border border-white/10 bg-gradient-to-br from-[#2a2826] via-[#1e1d1b] to-[#161514]">
                <div className="grid h-full w-full grid-cols-3 grid-rows-2 gap-px p-1 opacity-25">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <span key={i} className="rounded-[1px] bg-[#c4b49a]/40" />
                  ))}
                </div>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-zinc-600">
                <path d="M8.5 8.5a5 5 0 0 1 0 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M11.5 6a8 8 0 0 1 0 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
                <path d="M14.5 4a11 11 0 0 1 0 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
              </svg>
            </div>

            <div>
              <p className="text-[9px] uppercase tracking-[0.26em] text-zinc-600">Card holder</p>
              <p className="mt-1 truncate text-base font-medium tracking-wide text-zinc-100 sm:text-lg">
                {holderName}
              </p>
              <p className="mt-1.5 font-mono text-sm tracking-[0.2em] text-[#c4b49a]/90">
                {card.ruxstarId}
              </p>
            </div>

            <div className="flex items-end justify-between gap-3 border-t border-white/[0.06] pt-4">
              <div className="min-w-0">
                <p className="text-[8px] uppercase tracking-[0.24em] text-zinc-600">Aadhaar</p>
                <p className="mt-1 font-mono text-xs tracking-wider text-zinc-400">
                  {card.aadhaar ?? "XXXX XXXX XXXX"}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[8px] uppercase tracking-[0.24em] text-zinc-600">PAN</p>
                <p className="mt-1 font-mono text-xs uppercase tracking-wider text-zinc-400">
                  {card.pan ?? "XXXXX0000X"}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[8px] uppercase tracking-[0.24em] text-zinc-600">Member since</p>
                <p className="mt-1 font-mono text-xs tracking-wider text-zinc-500">
                  {memberSince ?? "—"}
                </p>
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
