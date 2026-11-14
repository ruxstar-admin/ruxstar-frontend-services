"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/profile/Avatar";
import { Icon, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useMe, useOnSignedOut } from "@/components/social/session";
import type { PublicProfile } from "@/lib/api/account";
import { findPeople } from "@/lib/api/social";
import { SkeletonRows } from "../notifications/screen";
import styles from "@/components/social/social.module.css";

const DEBOUNCE_MS = 250;
const MIN_QUERY = 2;
const RECENT_MAX = 10;

interface Outcome {
  term: string;
  people: PublicProfile[];
  failed: boolean;
}

/** Someone opened from Search, kept in this browser only. */
interface RecentPerson {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  city: string | null;
}

/** Each account has its own list, so a shared computer doesn't show one person's searches to another. */
const recentKey = (userId: string) => `ruxstar.search.recent.${userId}`;

function readRecent(userId: string): RecentPerson[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(recentKey(userId)) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value
      .filter((p): p is RecentPerson => !!p && typeof p.id === "string" && typeof p.name === "string" && typeof p.username === "string")
      .slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

function useRecentPeople(userId: string | undefined) {
  const [people, setPeople] = useState<RecentPerson[]>([]);
  useEffect(() => {
    if (userId) setPeople(readRecent(userId));
  }, [userId]);
  const save = (next: RecentPerson[]) => {
    setPeople(next);
    if (!userId) return;
    try {
      if (next.length) localStorage.setItem(recentKey(userId), JSON.stringify(next));
      else localStorage.removeItem(recentKey(userId));
    } catch {
      // Private browsing can refuse storage; the list still works for this visit.
    }
  };
  return {
    people,
    add: (p: RecentPerson) => save([p, ...people.filter((x) => x.id !== p.id)].slice(0, RECENT_MAX)),
    remove: (id: string) => save(people.filter((x) => x.id !== id)),
    clear: () => save([]),
  };
}

const subtitleOf = (p: { username: string; city: string | null }) => [`@${p.username}`, p.city].filter(Boolean).join(" · ");

/**
 * People by name or @username; shops are searched in Discover. Before typing, the people you opened from here
 * lately (this browser only), then the newest members. Stale answers are ignored.
 */
export function SearchScreen() {
  const onSignedOut = useOnSignedOut();
  const me = useMe();
  const recent = useRecentPeople(me?.id);
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

      {!term && recent.people.length > 0 && (
        <>
          <div className={styles.sectionRow}>
            <p className={styles.section}>Recent</p>
            <button type="button" className={styles.textButton} onClick={recent.clear}>
              Clear
            </button>
          </div>
          <ul className={styles.rows}>
            {recent.people.map((p) => (
              <li key={p.id} className={styles.personRow}>
                <Link href={`/u/${p.username}`} className={styles.row} onClick={() => recent.add(p)}>
                  <Avatar name={p.name} url={p.avatarUrl} size={44} />
                  <span className={styles.rowText}>
                    <span className={styles.rowTitle}>{p.name}</span>
                    <span className={styles.rowSub}>{subtitleOf(p)}</span>
                  </span>
                </Link>
                <button type="button" className={styles.removeButton} aria-label={`Remove ${p.name} from recent`} onClick={() => recent.remove(p.id)}>
                  <Icon name="close" size={18} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

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
                <Link
                  href={`/u/${p.username}`}
                  className={styles.row}
                  style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
                  onClick={() => recent.add({ id: p.id, name: p.name, username: p.username, avatarUrl: p.avatarUrl ?? null, city: p.city ?? null })}
                >
                  <Avatar name={p.name} url={p.avatarUrl} size={44} />
                  <span className={styles.rowText}>
                    <span className={styles.rowTitle}>{p.name}</span>
                    <span className={styles.rowSub}>{subtitleOf({ username: p.username, city: p.city ?? null })}</span>
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
