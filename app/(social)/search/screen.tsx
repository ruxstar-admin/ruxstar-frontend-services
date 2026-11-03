"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/profile/Avatar";
import { Icon, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import type { PublicProfile } from "@/lib/api/account";
import { findPeople } from "@/lib/api/social";
import { SkeletonRows } from "../notifications/screen";
import styles from "@/components/social/social.module.css";

const DEBOUNCE_MS = 250;
const MIN_QUERY = 2;

interface Outcome {
  term: string;
  people: PublicProfile[];
  failed: boolean;
}

/** People by name or @username. Before typing, the newest members. Stale answers are ignored. */
export function SearchScreen() {
  const onSignedOut = useOnSignedOut();
  const [query, setQuery] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const raw = query.trim().replace(/^@/, "");
  const term = raw.length >= MIN_QUERY ? raw : "";

  useEffect(() => {
    let live = true;
    const timer = setTimeout(
      () =>
        findPeople(term || undefined)
          .then((people) => live && setOutcome({ term, people, failed: false }))
          .catch((err) => live && !onSignedOut(err) && setOutcome({ term, people: [], failed: true })),
      term ? DEBOUNCE_MS : 0,
    );
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [term, onSignedOut]);

  const current = outcome?.term === term ? outcome : null;

  return (
    <div className={styles.column}>
      <h1 className="sr-only">Search</h1>
      <label className={styles.searchBox}>
        <Icon name="search" size={20} />
        <input
          className={styles.searchInput}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people by name or @username"
          aria-label="Search people"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
        />
      </label>

      {!current ? (
        <SkeletonRows />
      ) : current.failed ? (
        <Empty title="Search failed">
          <p>Check your connection and try again.</p>
        </Empty>
      ) : current.people.length === 0 ? (
        <Empty title={term ? "No one found" : "No one else here yet"}>
          <p>{term ? `Nobody matched "${raw}". Try a first name or a username.` : "Invite friends to join you on Ruxstar."}</p>
        </Empty>
      ) : (
        <>
          {!term && <p className={styles.section}>New on Ruxstar</p>}
          <ul className={styles.rows}>
            {current.people.map((p, i) => (
              <li key={p.id}>
                <Link href={`/u/${p.username}`} className={styles.row} style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
                  <Avatar name={p.name} url={p.avatarUrl} size={44} />
                  <span className={styles.rowText}>
                    <span className={styles.rowTitle}>{p.name}</span>
                    <span className={styles.rowSub}>{[`@${p.username}`, p.city].filter(Boolean).join(" · ")}</span>
                  </span>
                  {p.badges.vendor && <Tag>Vendor</Tag>}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
