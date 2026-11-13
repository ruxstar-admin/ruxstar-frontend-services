"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { ChatAvatar } from "@/components/chat/ChatAvatar";
import { seenMessageId } from "@/components/chat/merge";
import { useThread } from "@/components/chat/use-thread";
import { Avatar } from "@/components/profile/Avatar";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { Button, Icon, Skeleton, useToast } from "@/components/ui";
import { formError } from "@/lib/api/account";
import { acceptChat, declineChat, MESSAGE_TEXT_MAX, type ChatDetail, type ShownMessage } from "@/lib/api/chats";
import { exact } from "@/lib/time";
import styles from "@/components/chat/chat.module.css";
import social from "@/components/social/social.module.css";

/** A new time line shows after a quiet spell this long. */
const STAMP_GAP_MS = 15 * 60_000;
const NEAR_BOTTOM_PX = 240;

const time = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const dayTime = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const stampOf = (iso: string) => {
  const at = new Date(iso);
  return at.toDateString() === new Date().toDateString() ? time.format(at) : dayTime.format(at);
};

const nearBottom = () => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - NEAR_BOTTOM_PX;
const toBottom = () => window.scrollTo({ top: document.documentElement.scrollHeight });

const noticeOf = (chat: ChatDetail) => {
  if (chat.canSend) return null;
  return chat.waiting ? `You can send more once ${chat.title} accepts your request.` : "You can't message this account.";
};

function Content({ message }: { message: ShownMessage }) {
  if (message.kind === "photo") {
    const photo = message.upload ?? message.photo;
    if (!photo) return null;
    const img = <img src={photo.url} width={photo.width} height={photo.height} alt="Photo" loading="lazy" decoding="async" />;
    return message.upload ? (
      <span className={styles.photo}>{img}</span>
    ) : (
      <a href={photo.url} target="_blank" rel="noreferrer" className={styles.photo}>
        {img}
      </a>
    );
  }
  if (message.kind === "post") {
    const post = message.post;
    if (!post?.available || !post.author) return <span className={`${styles.post} ${styles.postGone}`}>This post isn&apos;t available.</span>;
    return (
      <Link href={`/p/${post.id}`} className={styles.post}>
        <span className={styles.postAuthor}>
          <Avatar name={post.author.name} url={post.author.avatarUrl} size={24} />
          {post.author.name}
        </span>
        {post.photo && <img className={styles.postPhoto} src={post.photo} alt="" loading="lazy" decoding="async" />}
        {post.text && <span className={styles.postText}>{post.text}</span>}
      </Link>
    );
  }
  return <span className={styles.bubble}>{message.text}</span>;
}

function Composer({ onSend, onPhoto }: { onSend: (text: string) => void; onPhoto: (file: File) => void }) {
  const [text, setText] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const trimmed = text.trim();

  useLayoutEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [text]);

  const send = () => {
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
    input.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  };

  return (
    <>
      <div className={styles.composer}>
        <button type="button" className={styles.iconButton} aria-label="Send a photo" onClick={() => file.current?.click()}>
          <Icon name="image" size={22} />
        </button>
        <input
          ref={file}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => {
            const chosen = e.target.files?.[0];
            e.target.value = "";
            if (chosen) onPhoto(chosen);
          }}
        />
        <textarea
          ref={input}
          className={styles.composerInput}
          value={text}
          maxLength={MESSAGE_TEXT_MAX}
          rows={1}
          placeholder="Message"
          aria-label="Message"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          autoFocus
        />
        <button type="button" className={styles.sendButton} aria-label="Send" disabled={!trimmed} onClick={send}>
          <Icon name="send" size={20} />
        </button>
      </div>
      {text.length > MESSAGE_TEXT_MAX - 100 && <p className={styles.charCount}>{`${text.length}/${MESSAGE_TEXT_MAX}`}</p>}
    </>
  );
}

/** A chat: newest at the bottom, polled every 3 seconds. Your own messages can be unsent for everyone. */
export function ThreadScreen({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const thread = useThread(id);
  const { chat, messages } = thread;
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<"accept" | "decline" | null>(null);
  const firstScroll = useRef(true);
  const lastId = useRef<string | null>(null);
  const keepFrom = useRef<number | null>(null);

  useEffect(() => {
    if (thread.error) onSignedOut(thread.error);
  }, [thread.error, onSignedOut]);

  // Opening a chat starts at the newest message; a new one keeps you there unless you scrolled up to read.
  useLayoutEffect(() => {
    if (keepFrom.current !== null) {
      window.scrollTo({ top: document.documentElement.scrollHeight - keepFrom.current });
      keepFrom.current = null;
      return;
    }
    const last = messages.at(-1);
    if (!last || last.id === lastId.current) return;
    const wasNear = lastId.current === null || nearBottom();
    lastId.current = last.id;
    if (firstScroll.current || last.mine || wasNear) toBottom();
    firstScroll.current = false;
  }, [messages]);

  const loadOlder = () => {
    keepFrom.current = document.documentElement.scrollHeight - window.scrollY;
    thread.loadOlder().finally(() => {
      keepFrom.current = null;
    });
  };

  const report = (err: unknown) => {
    if (err && !onSignedOut(err)) toast(formError(err).message, "danger");
  };

  const decide = async (accept: boolean) => {
    setDeciding(accept ? "accept" : "decline");
    try {
      if (accept) {
        thread.setChat(await acceptChat(id));
      } else {
        await declineChat(id);
        router.push("/messages");
      }
    } catch (err) {
      report(err);
    } finally {
      setDeciding(null);
    }
  };

  if (thread.loading) {
    return (
      <div className={styles.thread} aria-busy>
        <div className={styles.messages}>
          {[70, 50, 60].map((w, i) => (
            <div key={i} className={styles.line} data-mine={i % 2 ? true : undefined} style={{ width: `${w}%` }}>
              <Skeleton height={44} radius={20} />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (thread.error || !chat) {
    return (
      <div className={social.column}>
        <Empty title="Could not open this chat">
          <p>{formError(thread.error).message}</p>
          <Button variant="secondary" onClick={thread.reload}>
            Try again
          </Button>
        </Empty>
      </div>
    );
  }

  const isGroup = chat.kind === "group";
  const seenId = isGroup ? null : seenMessageId(messages, chat.seenAt);
  const subtitle = isGroup ? `${chat.members} people` : chat.peer ? `@${chat.peer.username}` : "";
  const notice = noticeOf(chat);

  return (
    <div className={styles.thread}>
      <header className={styles.threadHead}>
        <Link href="/messages" className={styles.iconButton} aria-label="All chats">
          <Icon name="arrow-left" size={22} />
        </Link>
        <Link href={`/messages/${id}/info`} className={styles.headLink} aria-label={`${chat.title}, chat details`}>
          <ChatAvatar chat={chat} size={40} />
          <span className={styles.headText}>
            <span className={styles.headTitle}>{chat.title}</span>
            {subtitle && <span className={styles.headSub}>{subtitle}</span>}
          </span>
        </Link>
        <Link href={`/messages/${id}/info`} className={styles.iconButton} aria-label="Chat details">
          <Icon name="info" size={22} />
        </Link>
      </header>

      <ol className={styles.messages} aria-label="Messages" aria-live="polite">
        {thread.hasOlder && (
          <li className={styles.older}>
            <Button variant="ghost" loading={thread.loadingOlder} onClick={loadOlder}>
              Show older messages
            </Button>
          </li>
        )}
        {messages.length === 0 && (
          <li>
            <Empty title="Say hello">
              <p>Your messages will appear here.</p>
            </Empty>
          </li>
        )}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const gap = !prev || new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() > STAMP_GAP_MS;
          const stamp = gap ? (
            <li key={`${m.id}-stamp`} className={styles.stamp}>
              {stampOf(m.createdAt)}
            </li>
          ) : null;
          if (m.kind === "event") {
            return [
              stamp,
              <li key={m.id} className={styles.event}>
                {m.text}
              </li>,
            ];
          }
          const newSender = gap || !prev || prev.kind === "event" || prev.mine !== m.mine || prev.sender?.id !== m.sender?.id;
          return [
            stamp,
            <li key={m.id} className={styles.line} data-mine={m.mine || undefined} data-gap={(newSender && !gap) || undefined} data-state={m.sendState}>
              {isGroup && !m.mine && newSender && m.sender && <span className={styles.sender}>{m.sender.name}</span>}
              <span className={styles.bubbleRow} title={exact(m.createdAt)}>
                <Content message={m} />
                {m.mine && m.sendState !== "sending" && confirming !== m.id && (
                  <button type="button" className={styles.lineAction} aria-label="Unsend" onClick={() => setConfirming(m.id)}>
                    <Icon name="trash" size={18} />
                  </button>
                )}
              </span>
              {confirming === m.id && (
                <span className={styles.confirm}>
                  Unsend for everyone?
                  <Button variant="ghost" onClick={() => setConfirming(null)}>
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    onClick={async () => {
                      setConfirming(null);
                      report(await thread.unsend(m));
                    }}
                  >
                    Unsend
                  </Button>
                </span>
              )}
              {m.sendState === "failed" && (
                <button type="button" className={styles.retry} onClick={() => thread.retry(m)}>
                  Not sent. Retry
                </button>
              )}
              {m.id === seenId && <span className={styles.note}>Seen</span>}
            </li>,
          ];
        })}
      </ol>

      <div className={styles.foot}>
        {chat.state === "request" ? (
          <div className={styles.request}>
            <p>
              {isGroup
                ? `You were invited to ${chat.title}. Join to read and reply.`
                : `${chat.title} wants to message you. They won't know you've seen it until you accept.`}
            </p>
            <div className={styles.requestButtons}>
              <Button variant="secondary" loading={deciding === "decline"} disabled={!!deciding} onClick={() => decide(false)}>
                Decline
              </Button>
              <Button loading={deciding === "accept"} disabled={!!deciding} onClick={() => decide(true)}>
                {isGroup ? "Join" : "Accept"}
              </Button>
            </div>
          </div>
        ) : notice ? (
          <p className={styles.notice}>{notice}</p>
        ) : (
          <Composer onSend={(text) => thread.send(text).then(report)} onPhoto={(file) => thread.sendFile(file).then(report)} />
        )}
      </div>
    </div>
  );
}
