"use client";

import { useEffect, useId, useState, type KeyboardEvent } from "react";
import { styles } from "@/components/admin/parts";
import { useUserSearch } from "@/components/admin/people";
import { Avatar } from "@/components/profile/Avatar";
import { Icon } from "@/components/ui";
import { formError } from "@/lib/api/account";
import { getUser } from "@/lib/api/admin";

interface Person {
  id: string;
  name: string;
  username: string;
  avatarUrl?: string | null;
}

const label = (p: Person) => (p.name && p.username ? `${p.name} (@${p.username})` : p.name || (p.username ? `@${p.username}` : `Account ${p.id.slice(-6)}`));

/** Who did it: anyone, or one person found by phone digits, @username or name. */
export function WhoFilter({ actor, onChange }: { actor: string; onChange: (id: string) => void }) {
  const id = useId();
  const [person, setPerson] = useState<Person | null>(null);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const { results, searching, error } = useUserSearch(open ? text : "");
  const shown = actor && person?.id === actor ? person : null;

  useEffect(() => {
    if (!actor || person?.id === actor) return;
    let live = true;
    getUser(actor).then(
      (u) => live && setPerson(u),
      () => live && setPerson({ id: actor, name: "", username: "" }),
    );
    return () => {
      live = false;
    };
  }, [actor, person?.id]);

  const options: (Person | null)[] = [null, ...(text.trim().length >= 2 ? (results ?? []) : [])];
  const optionId = (i: number) => `${id}-option-${i}`;

  const pick = (p: Person | null) => {
    setPerson(p);
    setOpen(false);
    setText("");
    onChange(p?.id ?? "");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setActive(0);
        return;
      }
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + step + options.length) % options.length);
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      pick(options[Math.min(active, options.length - 1)] ?? null);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
      setText("");
    }
  };

  const note =
    text.trim().length < 2
      ? "Type 2 or more characters: phone digits, @username or a name."
      : error
        ? formError(error).message
        : searching && !results
          ? "Searching…"
          : results?.length === 0
            ? "Nobody matches that."
            : null;

  return (
    <div className={styles.filter}>
      <label className={styles.filterLabel} htmlFor={`${id}-input`}>
        Who
      </label>
      <div className={styles.combo}>
        <input
          id={`${id}-input`}
          className={`${styles.filterControl} ${styles.comboInput}`}
          data-set={actor ? true : undefined}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={open ? optionId(Math.min(active, options.length - 1)) : undefined}
          aria-describedby={open && note ? `${id}-note` : undefined}
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder={actor && !shown ? "Loading…" : "Anyone"}
          value={open ? text : shown ? label(shown) : ""}
          onFocus={() => {
            setOpen(true);
            setActive(0);
          }}
          onBlur={() => {
            setOpen(false);
            setText("");
          }}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setActive(e.target.value.trim().length >= 2 ? 1 : 0);
          }}
          onKeyDown={onKeyDown}
        />
        <Icon name={open ? "search" : "chevron-down"} size={18} className={styles.comboIcon} />
      </div>
      {open && (
        <div className={styles.popup}>
          <ul id={`${id}-list`} role="listbox" aria-label="People" className={styles.options}>
            {options.map((p, i) => (
              <li
                key={p?.id ?? "anyone"}
                id={optionId(i)}
                role="option"
                aria-selected={i === active}
                className={styles.option}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(p)}
              >
                {p ? (
                  <>
                    <Avatar name={p.name || p.username} url={p.avatarUrl} size={28} />
                    <span className={styles.whoRow}>
                      <span className={styles.name}>{p.name || "No name"}</span>
                      <span className={`${styles.muted} ${styles.line}`}>@{p.username}</span>
                    </span>
                  </>
                ) : (
                  <span className={styles.whoRow}>
                    <span className={styles.name}>Anyone</span>
                  </span>
                )}
                {(p ? p.id === actor : !actor) && <Icon name="check" size={18} className={styles.chevron} />}
              </li>
            ))}
          </ul>
          {note && (
            <p id={`${id}-note`} className={styles.popupNote} aria-live="polite">
              {note}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
