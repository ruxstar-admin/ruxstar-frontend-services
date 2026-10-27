"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";

const LAUNCH_AT = Date.parse("2026-11-30T00:00:00+05:30");

const UNITS = [
  { one: "day", many: "days", ms: 86_400_000, mod: Infinity },
  { one: "hour", many: "hours", ms: 3_600_000, mod: 24 },
  { one: "minute", many: "minutes", ms: 60_000, mod: 60 },
  { one: "second", many: "seconds", ms: 1_000, mod: 60 },
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
    return <p className={styles.live}>We are live.</p>;
  }

  return (
    <div className={styles.countdown} role="timer" aria-label="Time until launch">
      {UNITS.map((u, i) => {
        const value = left === null ? null : Math.floor(left / u.ms) % u.mod;
        return (
          <div key={u.many} className={styles.unit} style={{ "--i": i } as React.CSSProperties}>
            <span className={styles.value}>
              {/* Re-keyed so each new number rises in. */}
              <span key={value ?? "-"} className={styles.digit}>
                {value === null ? "–" : value}
              </span>
            </span>
            <span className={styles.label}>{value === 1 ? u.one : u.many}</span>
          </div>
        );
      })}
    </div>
  );
}
