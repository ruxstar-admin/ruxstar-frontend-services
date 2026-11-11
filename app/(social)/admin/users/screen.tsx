"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Needs } from "@/components/admin/AdminFrame";
import { Failed, Rows, styles } from "@/components/admin/parts";
import { Avatar } from "@/components/profile/Avatar";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { Icon, Input, Segmented, Skeleton, Tag } from "@/components/ui";
import { findUsers, type UserRow, type UserStatus } from "@/lib/api/admin";
import { ago, exact } from "@/lib/time";
import { RoleTags, StatusTag } from "./tags";

type Filter = UserStatus | "all";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "locked", label: "On hold" },
  { value: "deleted", label: "Deleted" },
];

function Results({ q, filter }: { q: string; filter: Filter }) {
  const onSignedOut = useOnSignedOut();
  const load = useCallback((cursor?: string) => findUsers(q, filter === "all" ? undefined : filter, cursor), [q, filter]);
  const { items, loading, loadingMore, hasMore, error, more, reload } = usePages<UserRow>(load);
  const sentinel = useNearEnd(more, hasMore && !error);

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  if (loading) return <Rows count={5} />;
  if (error && items.length === 0) return <Failed error={error} onRetry={reload} />;
  if (items.length === 0) return <p className={styles.empty}>{q ? "Nobody matches that." : "No accounts here."}</p>;

  return (
    <ul className={styles.list}>
      {items.map((u) => (
        <li key={u.id} className={styles.item}>
          <Link href={`/admin/users/${u.id}`} className={styles.row}>
            <Avatar name={u.name || u.username} url={u.avatarUrl} size={44} />
            <span className={styles.whoRow}>
              <span className={styles.name}>{u.name || "No name"}</span>
              <span className={`${styles.muted} ${styles.line}`}>
                @{u.username} · {u.phone}
              </span>
            </span>
            <span className={styles.tags}>
              <RoleTags roles={u.roles} />
              {u.kyc.base === "approved" && <Tag tone="success">Verified</Tag>}
              {u.status !== "active" && <StatusTag status={u.status} />}
            </span>
            <time className={styles.time} dateTime={u.createdAt} title={`Joined ${exact(u.createdAt)}`}>
              {ago(u.createdAt)}
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

export function UsersScreen() {
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);

  return (
    <Needs need="users.view">
      <div className={styles.page}>
        <h1 className={styles.title}>People</h1>
        <div className={styles.toolbar}>
          <Input
            label="Find someone"
            placeholder="Phone, @username, name, email, card number or id"
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={80}
            autoComplete="off"
          />
          <Segmented label="Status" options={FILTERS} value={filter} onChange={setFilter} />
        </div>
        <Results key={`${filter}:${q}`} q={q} filter={filter} />
      </div>
    </Needs>
  );
}
