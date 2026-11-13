"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatAvatar } from "@/components/chat/ChatAvatar";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd } from "@/components/social/use-pages";
import { Button, ButtonLink, Icon, Segmented } from "@/components/ui";
import { formError } from "@/lib/api/account";
import { chatList, chatUnread, type Chat, type ChatBox } from "@/lib/api/chats";
import { ago, exact } from "@/lib/time";
import { SkeletonRows } from "../notifications/screen";
import styles from "@/components/social/social.module.css";
import chat from "@/components/chat/chat.module.css";

const REFRESH_MS = 15_000;
const PAGE = 20;
const MAX_PAGE = 50;

interface List {
  box: ChatBox;
  items: Chat[];
  cursor: string | null;
}

/** One box of chats, newest message first. Refreshes every 15 seconds while in view, keeping pages already scrolled to. */
function useChatList(box: ChatBox) {
  const onSignedOut = useOnSignedOut();
  const [list, setList] = useState<List | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [more, setMore] = useState(false);
  const [requests, setRequests] = useState(0);
  const held = useRef(0);

  const refresh = useCallback(() => {
    if (document.visibilityState !== "visible") return;
    const limit = Math.min(MAX_PAGE, Math.max(PAGE, held.current));
    chatList(box, undefined, limit).then(
      (page) => {
        held.current = page.items.length;
        setList({ box, items: page.items, cursor: page.nextCursor });
        setError(null);
      },
      (err) => {
        if (!onSignedOut(err)) setError(err);
      },
    );
    chatUnread().then((c) => setRequests(c.requests), () => undefined);
  }, [box, onSignedOut]);

  useEffect(() => {
    held.current = 0;
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [refresh]);

  const current = list?.box === box ? list : null;

  const loadMore = () => {
    if (!current?.cursor || more) return;
    setMore(true);
    chatList(box, current.cursor)
      .then((page) =>
        setList((prev) => {
          if (!prev || prev.box !== box) return prev;
          const known = new Set(prev.items.map((c) => c.id));
          const items = [...prev.items, ...page.items.filter((c) => !known.has(c.id))];
          held.current = items.length;
          return { box, items, cursor: page.nextCursor };
        }),
      )
      .catch(() => undefined)
      .finally(() => setMore(false));
  };

  return { list: current, error: current ? null : error, more, loadMore, refresh, requests };
}

function ChatRow({ chat: c }: { chat: Chat }) {
  const unread = c.unread > 0;
  const preview = c.last ? `${c.last.mine && c.last.kind !== "event" ? "You: " : ""}${c.last.text}` : c.state === "request" ? "Wants to message you" : "No messages yet";
  return (
    <li>
      <Link href={`/messages/${c.id}`} className={styles.row}>
        <ChatAvatar chat={c} />
        <span className={styles.rowText}>
          <span className={styles.rowTitle}>{c.title}</span>
          <span className={chat.preview} data-unread={unread || undefined}>
            {preview}
          </span>
        </span>
        <span className={chat.rowEnd}>
          {c.last && (
            <time dateTime={c.last.at} title={exact(c.last.at)}>
              {ago(c.last.at)}
            </time>
          )}
          {unread ? (
            <span className={chat.count} data-muted={c.muted || undefined} aria-label={`${c.unread} unread`}>
              {c.unread > 99 ? "99+" : c.unread}
            </span>
          ) : c.muted ? (
            <span className={chat.muted} aria-label="Muted">
              <Icon name="bell-off" size={16} />
            </span>
          ) : null}
        </span>
      </Link>
    </li>
  );
}

/** Your chats, and message requests from people you don't follow. */
export function MessagesScreen() {
  const [box, setBox] = useState<ChatBox>("chats");
  const { list, error, more, loadMore, refresh, requests } = useChatList(box);
  const sentinel = useNearEnd(loadMore, !!list?.cursor);

  return (
    <div className={styles.column}>
      <div className={styles.headRow}>
        <h1 className={styles.title}>Messages</h1>
        <ButtonLink href="/messages/new" variant="secondary" icon={<Icon name="edit" size={18} />}>
          New chat
        </ButtonLink>
      </div>
      <div className={chat.tabs}>
        <Segmented
          label="Messages"
          options={[
            { value: "chats", label: "Chats" },
            { value: "requests", label: requests > 0 ? `Requests (${requests})` : "Requests" },
          ]}
          value={box}
          onChange={setBox}
        />
      </div>

      {!list ? (
        error ? (
          <div className={styles.failed} role="alert">
            <p>{formError(error).message}</p>
            <Button variant="secondary" onClick={refresh}>
              Try again
            </Button>
          </div>
        ) : (
          <SkeletonRows />
        )
      ) : list.items.length === 0 ? (
        box === "chats" ? (
          <Empty title="No chats yet">
            <p>Start one with New chat, or with Message on someone&apos;s profile.</p>
          </Empty>
        ) : (
          <Empty title="No requests">
            <p>Messages and group invites from people you don&apos;t follow land here.</p>
          </Empty>
        )
      ) : (
        <ul className={styles.rows}>
          {list.items.map((c) => (
            <ChatRow key={c.id} chat={c} />
          ))}
          {list.cursor && <li ref={sentinel} className={styles.sentinel} aria-hidden />}
          {more && <SkeletonRows count={1} />}
        </ul>
      )}
    </div>
  );
}
