import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { BLUE, YELLOW } from "@/components/brand/StarMark";
import { ButtonLink } from "@/components/ui";
import styles from "./not-found.module.css";
import { SearchPeopleLink } from "./search-link";

export const metadata: Metadata = {
  title: "Page not found · Ruxstar",
};

/** x and y in percent of the page, size in px, delay in seconds. Fixed so the server and browser agree. */
const STARS: [number, number, number, number][] = [
  [8, 14, 2, 0],
  [21, 72, 1, 1.8],
  [33, 22, 2, 3.1],
  [46, 86, 1, 0.6],
  [58, 10, 1, 2.4],
  [67, 64, 2, 4.2],
  [79, 28, 1, 1.2],
  [88, 78, 2, 3.6],
  [93, 46, 1, 0.3],
  [14, 44, 1, 2.9],
  [52, 36, 1, 4.8],
  [72, 92, 1, 1.5],
];

export default function NotFound() {
  return (
    <main className={styles.page}>
      <div className={styles.sky} aria-hidden>
        {STARS.map(([x, y, size, delay]) => (
          <span
            key={`${x}-${y}`}
            className={styles.dot}
            style={{ "--x": `${x}%`, "--y": `${y}%`, "--size": `${size}px`, "--delay": `${delay}s` } as CSSProperties}
          />
        ))}
      </div>

      <header className={styles.bar}>
        <Link href="/" className="brand">
          <img src="/logo.svg" width={30} height={30} alt="" />
          <span>ruxstar</span>
        </Link>
      </header>

      <section className={styles.body}>
        <div className={styles.code} aria-hidden>
          <span className={styles.digit}>
            <span>4</span>
          </span>
          <svg className={styles.star} viewBox="200 160 630 630">
            <g className={`${styles.gap} ${styles.gapYellow}`}>
              <path className={`${styles.half} ${styles.yellow}`} d={YELLOW} />
            </g>
            <g className={`${styles.gap} ${styles.gapBlue}`}>
              <path className={`${styles.half} ${styles.blue}`} d={BLUE} />
            </g>
          </svg>
          <span className={`${styles.digit} ${styles.late}`}>
            <span>4</span>
          </span>
        </div>

        <h1 className={styles.title}>This page wandered off</h1>
        <p className={styles.lede}>The link may be broken, or the page has moved.</p>
        <div className={styles.actions}>
          <ButtonLink href="/">Go home</ButtonLink>
          <SearchPeopleLink />
        </div>
      </section>
    </main>
  );
}
