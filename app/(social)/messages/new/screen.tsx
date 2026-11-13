"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { usePeopleSearch } from "@/components/chat/use-people-search";
import { Avatar } from "@/components/profile/Avatar";
import { Empty } from "@/components/social/PostList";
import { useBack } from "@/components/social/Shell";
import { useOnSignedOut } from "@/components/social/session";
import { Button, Icon, Input, Segmented, Tag, useToast } from "@/components/ui";
import { formError, type PublicProfile } from "@/lib/api/account";
import { addPeople, createGroup, GROUP_MAX, GROUP_TITLE_MAX, startDm } from "@/lib/api/chats";
import { SkeletonRows } from "../../notifications/screen";
import styles from "@/components/chat/chat.module.css";
import social from "@/components/social/social.module.css";

type Mode = "direct" | "group";

/** Message one person, start a group, or (with `addTo`) add people to a group you run. */
export function NewChatScreen({ addTo }: { addTo: { id: string; size: number } | null }) {
  const router = useRouter();
  const back = useBack();
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const [mode, setMode] = useState<Mode>(addTo ? "group" : "direct");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<PublicProfile[]>([]);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const results = usePeopleSearch(query);
  const room = addTo ? GROUP_MAX - addTo.size : GROUP_MAX - 1;
  const picking = mode === "group";

  const fail = (err: unknown) => {
    if (!onSignedOut(err)) toast(formError(err).message, "danger");
  };

  const open = async (person: PublicProfile) => {
    setBusy(person.id);
    try {
      const chat = await startDm(person.id);
      router.replace(`/messages/${chat.id}`);
    } catch (err) {
      fail(err);
      setBusy(null);
    }
  };

  const toggle = (person: PublicProfile) =>
    setPicked((prev) => (prev.some((p) => p.id === person.id) ? prev.filter((p) => p.id !== person.id) : prev.length >= room ? prev : [...prev, person]));

  const submit = async () => {
    setBusy("submit");
    try {
      const ids = picked.map((p) => p.id);
      if (addTo) {
        await addPeople(addTo.id, ids);
        router.replace(`/messages/${addTo.id}/info`);
      } else {
        const chat = await createGroup(title.trim(), ids);
        router.replace(`/messages/${chat.id}`);
      }
    } catch (err) {
      fail(err);
      setBusy(null);
    }
  };

  const full = picked.length >= room;

  return (
    <div className={social.column}>
      <button type="button" className={social.back} onClick={back}>
        <Icon name="arrow-left" size={18} /> Back
      </button>
      <div className={social.headRow}>
        <h1 className={social.title}>{addTo ? "Add people" : "New chat"}</h1>
      </div>

      {!addTo && (
        <div className={styles.tabs}>
          <Segmented
            label="Kind of chat"
            options={[
              { value: "direct", label: "Message someone" },
              { value: "group", label: "New group" },
            ]}
            value={mode}
            onChange={setMode}
          />
        </div>
      )}

      {picking && (
        <div className={styles.form}>
          {!addTo && (
            <Input label="Group name" value={title} maxLength={GROUP_TITLE_MAX} onChange={(e) => setTitle(e.target.value)} placeholder="Weekend plans" />
          )}
          {picked.length > 0 && (
            <ul className={styles.picked} aria-label="Chosen">
              {picked.map((p) => (
                <li key={p.id}>
                  <button type="button" className={styles.chip} onClick={() => toggle(p)} aria-label={`Remove ${p.name}`}>
                    <Avatar name={p.name} url={p.avatarUrl} size={28} />
                    {p.name}
                    <Icon name="close" size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className={styles.formActions}>
            <span className={styles.hint}>
              {full ? `A group holds up to ${GROUP_MAX} people.` : picked.length === 0 ? "Pick at least one person." : `${picked.length} chosen`}
            </span>
            <Button onClick={submit} loading={busy === "submit"} disabled={picked.length === 0 || (!addTo && !title.trim()) || (busy !== null && busy !== "submit")}>
              {addTo ? "Add" : "Create group"}
            </Button>
          </div>
          <p className={styles.hint}>People who don&apos;t follow you get an invite in their Requests and join when they accept.</p>
        </div>
      )}

      <label className={styles.searchSmall}>
        <Icon name="search" size={18} />
        <input
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

      {!results ? (
        <SkeletonRows />
      ) : results.failed ? (
        <Empty title="Search failed">
          <p>Check your connection and try again.</p>
        </Empty>
      ) : results.people.length === 0 ? (
        <Empty title="No one found">
          <p>Try a first name or a username.</p>
        </Empty>
      ) : (
        <ul className={social.rows}>
          {results.people.map((p) => {
            const on = picked.some((x) => x.id === p.id);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  className={styles.pickRow}
                  aria-pressed={picking ? on : undefined}
                  disabled={busy !== null || (picking && !on && full)}
                  onClick={() => (picking ? toggle(p) : open(p))}
                >
                  <Avatar name={p.name} url={p.avatarUrl} size={44} busy={busy === p.id} />
                  <span className={social.rowText}>
                    <span className={social.rowTitle}>{p.name}</span>
                    <span className={social.rowSub}>@{p.username}</span>
                  </span>
                  {p.badges.vendor && <Tag>Vendor</Tag>}
                  {picking && (
                    <span className={styles.tick} data-on={on || undefined} aria-hidden>
                      <Icon name="check" size={14} />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
