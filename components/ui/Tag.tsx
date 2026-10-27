import type { ComponentProps } from "react";
import styles from "./Tag.module.css";

export type TagTone = "neutral" | "solid" | "success" | "warning" | "danger";

export function Tag({ tone = "neutral", className, ...rest }: ComponentProps<"span"> & { tone?: TagTone }) {
  return <span className={[styles.tag, styles[tone], className].filter(Boolean).join(" ")} {...rest} />;
}
