import type { CSSProperties } from "react";
import styles from "@/app/(auth)/auth.module.css";

const SPARKS = Array.from({ length: 8 }, (_, i) => ({
  angle: `${i * 45 + 22.5}deg`,
  reach: i % 2 === 0 ? "92px" : "78px",
  size: i % 2 === 0 ? "7px" : "5px",
}));

/** The signup success mark, the same beats as the app's. Reduced motion shows it still. */
export function SuccessBadge() {
  return (
    <div className={styles.badgeStage} role="img" aria-label="Account created">
      <span className={styles.ripple} />
      <span className={styles.ripple} />
      {SPARKS.map((s) => (
        <span
          key={s.angle}
          className={styles.spark}
          style={{ "--angle": s.angle, "--reach": s.reach, "--size": s.size } as CSSProperties}
        />
      ))}
      <span className={styles.badge}>
        <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden>
          <path d="M30 50 L43 63 L67 37" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </div>
  );
}
