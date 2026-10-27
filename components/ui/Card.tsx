import type { HTMLAttributes } from "react";
import styles from "./Card.module.css";

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: "div" | "article" | "section" | "li";
  /** Lifts on hover and presses in. Use when the whole card is a link or button. */
  interactive?: boolean;
  padding?: "none" | "md" | "lg";
  sunk?: boolean;
}

export function Card({ as: Tag = "div", interactive, padding = "md", sunk, className, ...rest }: CardProps) {
  const cls = [styles.card, styles[padding], interactive && styles.interactive, sunk && styles.sunk, className]
    .filter(Boolean)
    .join(" ");
  return <Tag className={cls} {...rest} />;
}
