import type { CSSProperties } from "react";
import styles from "./Skeleton.module.css";

interface SkeletonProps {
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
  radius?: CSSProperties["borderRadius"];
  className?: string;
}

/** Placeholder with the shape of the content that is loading. Wrap a group in `aria-busy`. */
export function Skeleton({ width = "100%", height = 16, radius = 8, className }: SkeletonProps) {
  return (
    <span
      aria-hidden
      className={[styles.skeleton, className].filter(Boolean).join(" ")}
      style={{ width, height, borderRadius: radius }}
    />
  );
}
