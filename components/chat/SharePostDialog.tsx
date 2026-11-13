"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/profile/Avatar";
import { Button, Icon } from "@/components/ui";
import { ApiError, newIdempotencyKey } from "@/lib/api/client";
import { chatList, sendMessage, startDm, type Chat } from "@/lib/api/chats";
import { ChatAvatar } from "./ChatAvatar";
import { usePeopleSearch } from "./use-people-search";
import styles from "./chat.module.css";
import social from "@/components/social/social.module.css";

type SendState = "sending" | "sent" | "waiting" | "failed";

interface Target {
  key: string;
  title: string;
  subtitle: string;
  avatar: React.ReactNode;
  send: () => Promise<unknown>;
}

/** Send a post into a chat: your recent chats, or anyone you search for. Share link covers other apps. */
export function SharePostDialog({ postId, open, onClose, onShareLink }: { postId: string; open: boolean; onClose: () => void; onShareLink: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [chats, setChats] = useState<Chat[] | null>(null);
  const [states, setStates] = useState<Record<string, SendState>>({});
  const searching = query.trim().length > 0;
  const people = usePeopleSearch(query, open && searching);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let live = true;
    chatList("chats").then(
      (page) => live && setChats(page.items),
      () => live && setChats([]),
    );
    return () => {
      live = false;
    };
  }, [open]);

  const close = () => {
    setQuery("");
    setStates({});
    onClose();
  };

  const toChat = (chatId: string) => sendMessage(chatId, { postId }, newIdempotencyKey());

  const targets: Target[] | null = searching
    ? (people?.people.map((p) => ({
        key: `user:${p.id}`,
        title: p.name,
        subtitle: `@${p.username}`,
        avatar: <Avatar name={p.name} url={p.avatarUrl} size={40} />,
        send: async () => toChat((await startDm(p.id)).id),
      })) ?? null)
    : (chats?.map((c) => ({
        key: `chat:${c.id}`,
        title: c.title,
        subtitle: c.kind === "group" ? `${c.members} people` : c.peer ? `@${c.peer.username}` : "",
        avatar: <ChatAvatar chat={c} size={40} />,
        send: () => toChat(c.id),
      })) ?? null);

  const send = async (target: Target) => {
    setStates((prev) => ({ ...prev, [target.key]: "sending" }));
    try {
      await target.send();
      setStates((prev) => ({ ...prev, [target.key]: "sent" }));
    } catch (err) {
      const waiting = err instanceof ApiError && err.code === "CHAT_REQUEST_PENDING";
      setStates((prev) => ({ ...prev, [target.key]: waiting ? "waiting" : "failed" }));
    }
  };

  return (
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={`share-${postId}`} onClose={close} onClick={(e) => e.target === e.currentTarget && close()}>
      <div className={styles.dialogBody}>
        <div className={styles.dialogHead}>
          <h2 id={`share-${postId}`} className={styles.dialogTitle}>
            Send to
          </h2>
          <button type="button" className={styles.iconButton} aria-label="Close" onClick={close}>
            <Icon name="close" size={20} />
          </button>
        </div>
        <label className={styles.searchSmall}>
          <Icon name="search" size={18} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people"
            aria-label="Search people"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
          />
        </label>
        <ul className={`${social.rows} ${styles.dialogList}`}>
          {targets === null ? (
            <li className={styles.hint}>Loading…</li>
          ) : targets.length === 0 ? (
            <li className={styles.hint}>{searching ? "No one found." : "No chats yet. Search for someone."}</li>
          ) : (
            targets.map((t) => {
              const state = states[t.key];
              return (
                <li key={t.key} className={styles.shareRow}>
                  {t.avatar}
                  <span className={social.rowText}>
                    <span className={social.rowTitle}>{t.title}</span>
                    <span className={styles.shareStatus} data-tone={state === "failed" ? "danger" : undefined}>
                      {state === "waiting" ? "Waiting for them to accept your request" : state === "failed" ? "Not sent. Try again." : t.subtitle}
                    </span>
                  </span>
                  <Button
                    variant={state === "sent" || state === "waiting" ? "ghost" : "primary"}
                    loading={state === "sending"}
                    disabled={state === "sent" || state === "waiting"}
                    onClick={() => send(t)}
                    aria-label={state === "sent" ? `Sent to ${t.title}` : `Send to ${t.title}`}
                  >
                    {state === "sent" ? "Sent" : "Send"}
                  </Button>
                </li>
              );
            })
          )}
        </ul>
        <div className={styles.dialogFoot}>
          <Button
            variant="secondary"
            block
            icon={<Icon name="share" size={18} />}
            onClick={() => {
              close();
              onShareLink();
            }}
          >
            Share link
          </Button>
        </div>
      </div>
    </dialog>
  );
}
