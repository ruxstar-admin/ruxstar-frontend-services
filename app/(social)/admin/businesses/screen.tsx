"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Needs } from "@/components/admin/AdminFrame";
import { Failed, Rows, styles } from "@/components/admin/parts";
import { Avatar } from "@/components/profile/Avatar";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { Icon, Input, Segmented, Skeleton } from "@/components/ui";
import { findBusinesses, type Business, type BusinessFilter, type BusinessRow, type BusinessState } from "@/lib/api/admin";
import { ago, exact } from "@/lib/time";
import { MODULE_LABEL } from "../modules/labels";
import { BusinessTag } from "./tags";

type State = BusinessState | "all";

const STATES: { value: State; label: string }[] = [
  { value: "all", label: "All" },
  { value: "live", label: "Live" },
  { value: "draft", label: "Drafts" },
  { value: "suspended", label: "On hold" },
];

const MODULES: Business["module"][] = ["pod", "events", "coaching", "stays"];

function Results({ filter }: { filter: BusinessFilter }) {
  const onSignedOut = useOnSignedOut();
  const load = useCallback((cursor?: string) => findBusinesses(filter, cursor), [filter]);
  const { items, loading, loadingMore, hasMore, error, more, reload } = usePages<BusinessRow>(load);
  const sentinel = useNearEnd(more, hasMore && !error);

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  if (loading) return <Rows count={5} />;
  if (error && items.length === 0) return <Failed error={error} onRetry={reload} />;
  if (items.length === 0) return <p className={styles.empty}>{filter.q ? "No business matches that." : "No businesses here yet."}</p>;

  return (
    <ul className={styles.list}>
      {items.map(({ business: b, owner }) => (
        <li key={b.id} className={styles.item}>
          <Link href={`/admin/businesses/${b.id}`} className={styles.row}>
            <Avatar name={b.name} url={b.photos[0]?.url ?? null} size={44} />
            <span className={styles.whoRow}>
              <span className={styles.name}>{b.name}</span>
              <span className={`${styles.muted} ${styles.line}`}>
                {MODULE_LABEL[b.module]} · {owner ? `@${owner.username}` : "Owner gone"}
              </span>
            </span>
            <span className={styles.tags}>
              <BusinessTag business={b} />
            </span>
            <time className={styles.time} dateTime={b.updatedAt} title={`Changed ${exact(b.updatedAt)}`}>
              {ago(b.updatedAt)}
            </time>
            <Icon name="chevron-right" size={20} className={styles.chevron} />
          </Link>
        </li>
      ))}
      {hasMore && <li ref={sentinel} aria-hidden />}
      {loadingMore && <Skeleton height={72} radius={14} />}
    </ul>
  );
}

export function BusinessesScreen() {
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [state, setState] = useState<State>("all");
  const [module, setModule] = useState<Business["module"] | "">("");

  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);

  const filter: BusinessFilter = { ...(q ? { q } : {}), ...(state === "all" ? {} : { state }), ...(module ? { module } : {}) };

  return (
    <Needs need="businesses.view">
      <div className={styles.page}>
        <h1 className={styles.title}>Businesses</h1>
        <div className={styles.toolbar}>
          <Input
            label="Find a business"
            placeholder="Business name, business id or owner id"
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={80}
            autoComplete="off"
          />
          <select className={styles.select} aria-label="Module" value={module} onChange={(e) => setModule(e.target.value as Business["module"] | "")}>
            <option value="">Every module</option>
            {MODULES.map((m) => (
              <option key={m} value={m}>
                {MODULE_LABEL[m]}
              </option>
            ))}
          </select>
          <Segmented label="State" options={STATES} value={state} onChange={setState} />
        </div>
        <Results key={`${state}:${module}:${q}`} filter={filter} />
      </div>
    </Needs>
  );
}
