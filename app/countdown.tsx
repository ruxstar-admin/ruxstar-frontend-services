"use client";

import { useEffect, useState } from "react";

const LAUNCH_AT = Date.parse("2026-11-30T00:00:00+05:30");

const UNITS = [
  { label: "Days", ms: 86_400_000, mod: Infinity },
  { label: "Hours", ms: 3_600_000, mod: 24 },
  { label: "Minutes", ms: 60_000, mod: 60 },
  { label: "Seconds", ms: 1_000, mod: 60 },
];

export function Countdown() {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const left = now === null ? null : Math.max(0, LAUNCH_AT - now);

  if (left === 0) {
    return <p className="live">We are live.</p>;
  }

  return (
    <div className="countdown" role="timer" aria-label="Time until launch">
      {UNITS.map((u) => {
        const value = left === null ? null : Math.floor(left / u.ms) % u.mod;
        return (
          <div key={u.label} className="unit">
            <span className="value">{value === null ? "--" : String(value).padStart(2, "0")}</span>
            <span className="label">{u.label}</span>
          </div>
        );
      })}
    </div>
  );
}
