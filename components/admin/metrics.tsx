"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { styles } from "@/components/admin/parts";
import { useOnSignedOut } from "@/components/social/session";
import { Button, Card, Icon, Skeleton, type IconName } from "@/components/ui";
import { clock, exact } from "@/lib/time";

type Tone = "warn" | "good" | "quiet";
type Tint = "amber" | "blue" | "purple" | "green";

export const count = (n: number) => n.toLocaleString("en-IN");
export const waiting = (n: number): Tone | undefined => (n > 0 ? "warn" : undefined);
/** "1 withdrawal", "3 withdrawals". */
export const plural = (n: number, one: string, many = `${one}s`) => `${count(n)} ${n === 1 ? one : many}`;

/** One source, loaded on its own so a slow or failing one doesn't hold the others back. An error shows only for the latest attempt; the last numbers stay while it reloads. */
export function useLoad<T>(load: () => Promise<T>, enabled: boolean, attempt: number) {
  const onSignedOut = useOnSignedOut();
  const [result, setResult] = useState<{ at: number; data?: T; error?: unknown }>({ at: -1 });

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    load().then(
      (data) => live && setResult({ at: attempt, data }),
      (error) => live && !onSignedOut(error) && setResult((r) => ({ ...r, at: attempt, error })),
    );
    return () => {
      live = false;
    };
  }, [load, enabled, attempt, onSignedOut]);

  return { data: result.data, error: result.at === attempt ? result.error : undefined, loading: enabled && result.at !== attempt };
}

export function Group({
  title,
  icon,
  tint,
  aside,
  wide,
  children,
}: {
  title: string;
  icon: IconName;
  tint?: Tint;
  aside?: ReactNode;
  /** Room for module cards instead of single numbers. */
  wide?: boolean;
  children: ReactNode;
}) {
  const id = `metrics-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  const head = (
    <h2 id={id} className={styles.metricHead}>
      <span className={styles.metricIcon} data-tint={tint}>
        <Icon name={icon} size={18} />
      </span>
      {title}
    </h2>
  );
  return (
    <Card as="section" padding="lg" aria-labelledby={id}>
      {aside ? (
        <div className={styles.metricTop}>
          {head}
          {aside}
        </div>
      ) : (
        head
      )}
      <div className={wide ? styles.moduleGrid : styles.metrics}>{children}</div>
    </Card>
  );
}

/** A number and what it counts; opens its page when it has one. */
export function Metric({ href, label, value, detail, tone }: { href?: string; label: string; value: string; detail?: string; tone?: Tone }) {
  const body = (
    <>
      <span className={styles.metricValue}>{value}</span>
      <span className={styles.metricLabel}>{label}</span>
      {detail && <span className={styles.metricDetail}>{detail}</span>}
    </>
  );
  return href ? (
    <Link href={href} className={styles.metric} data-tone={tone}>
      {body}
    </Link>
  ) : (
    <div className={styles.metric} data-tone={tone}>
      {body}
    </div>
  );
}

export function Cells({ n }: { n: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <Skeleton key={i} height={76} radius={12} />
      ))}
    </>
  );
}

/** When the numbers were counted, and a way to count again. */
export function Freshness({ asOf, loading, failed, onRefresh }: { asOf: string; loading: boolean; failed: boolean; onRefresh: () => void }) {
  return (
    <div className={styles.freshness}>
      <p className={styles.muted} role="status">
        {failed && <span className={styles.warnText}>Couldn&apos;t refresh. </span>}
        As of{" "}
        <time dateTime={asOf} title={exact(asOf)}>
          {clock(asOf)}
        </time>
      </p>
      <Button variant="secondary" icon={<Icon name="refresh" size={18} />} loading={loading} onClick={onRefresh}>
        Refresh
      </Button>
    </div>
  );
}
