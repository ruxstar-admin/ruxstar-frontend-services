"use client";

import { useState } from "react";
import { usePeopleSearch } from "@/components/chat/use-people-search";
import { Avatar } from "@/components/profile/Avatar";
import { Icon } from "@/components/ui";
import type { PublicProfile } from "@/lib/api/account";
import chat from "@/components/chat/chat.module.css";
import styles from "./team.module.css";

const MIN_CHARS = 2;
const MAX_SHOWN = 8;

interface PersonSearchProps {
  picked: PublicProfile | null;
  onPick: (person: PublicProfile | null) => void;
  /** People already on the team or invited: shown, but they can't be picked again. */
  taken: ReadonlySet<string>;
  error?: string;
}

/** Find someone to invite by name or username, then pick them. Same as the app. */
export function PersonSearch({ picked, onPick, taken, error }: PersonSearchProps) {
  const [query, setQuery] = useState("");
  const term = query.trim().replace(/^@/, "");
  const searching = !picked && term.length >= MIN_CHARS;
  const results = usePeopleSearch(query, searching);

  if (picked) {
    return (
      <div className={styles.picker}>
        <span className={styles.label}>Inviting</span>
        <div className={styles.pickedPerson} data-invalid={error ? true : undefined}>
          <Avatar name={picked.name} url={picked.avatarUrl} size={44} />
          <span className={styles.text}>
            <span className={styles.name}>{picked.name}</span>
            <span className={styles.line}>@{picked.username}</span>
          </span>
          <button type="button" className={styles.change} onClick={() => onPick(null)} aria-label={`Change from ${picked.name}`}>
            Change
          </button>
        </div>
        <p className={error ? styles.error : styles.muted} role={error ? "alert" : undefined}>
          {error ?? "They get a notification and have 7 days to accept."}
        </p>
      </div>
    );
  }

  return (
    <div className={styles.picker}>
      <span className={styles.label}>Who to invite</span>
      <label className={chat.searchSmall}>
        <Icon name="search" size={18} />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or username"
          aria-label="Search people to invite"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={40}
          autoFocus
        />
      </label>
      {!searching ? (
        <p className={styles.muted}>Type at least 2 letters of their name or username.</p>
      ) : !results ? (
        <p className={styles.muted} aria-busy>
          Searching…
        </p>
      ) : results.failed ? (
        <p className={styles.error}>Could not search right now. Check your connection and try again.</p>
      ) : results.people.length === 0 ? (
        <p className={styles.muted}>{`No one found for “${term}”. Check the spelling, or ask them for their username.`}</p>
      ) : (
        <ul className={styles.switches} aria-label="People found">
          {results.people.slice(0, MAX_SHOWN).map((person) => {
            const onTeam = taken.has(person.id);
            return (
              <li key={person.id}>
                <button type="button" className={styles.member} disabled={onTeam} onClick={() => onPick(person)}>
                  <Avatar name={person.name} url={person.avatarUrl} size={40} />
                  <span className={styles.text}>
                    <span className={styles.name}>{person.name}</span>
                    <span className={styles.line}>@{person.username}</span>
                  </span>
                  {onTeam ? <span className={styles.line}>On the team</span> : <Icon name="plus" size={20} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
