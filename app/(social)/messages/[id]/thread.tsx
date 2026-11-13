"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { ChatAvatar } from "@/components/chat/ChatAvatar";
import { seenMessageId } from "@/components/chat/merge";
import { MessageMenu } from "@/components/chat/MessageMenu";
import { layoutThread, type ThreadRow } from "@/components/chat/thread-layout";
import { useThread } from "@/components/chat/use-thread";
import { Avatar } from "@/components/profile/Avatar";
import { Lightbox } from "@/components/social/Lightbox";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { Button, Icon, Skeleton, useToast } from "@/components/ui";
import { formError } from "@/lib/api/account";
import { acceptChat, declineChat, MESSAGE_TEXT_MAX, type ChatDetail, type ShownMessage } from "@/lib/api/chats";
import { exact } from "@/lib/time";
import styles from "@/components/chat/chat.module.css";
import social from "@/components/social/social.module.css";

const NEAR_BOTTOM_PX = 240;
/** Holding a message this long on a touch screen opens its menu, as in the app. */
const HOLD_MS = 450;
const HOLD_SLOP_PX = 10;
const AVATAR = 28;

/** Touch-and-hold for touch screens; mouse users right-click or use the ⋯ button. */
function useHold(onHold: () => void) {
  const timer = useRef<number | null>(null);
  const start = useRef({ x: 0, y: 0 });
  const held = useRef(false);
  const cancel = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => cancel, []);
  return {
    onPointerDown: (e: PointerEvent) => {
      held.current = false;
      if (e.pointerType === "mouse") return;
      start.current = { x: e.clientX, y: e.clientY };
      cancel();
      timer.current = window.setTimeout(() => {
        held.current = true;
        navigator.vibrate?.(10);
        onHold();
      }, HOLD_MS);
    },
    onPointerMove: (e: PointerEvent) => {
      if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > HOLD_SLOP_PX) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e: MouseEvent) => {
      e.preventDefault();
      cancel();
      if (!held.current) onHold();
    },
    /** A tap that ended a hold mustn't also open the photo or post. */
    onClickCapture: (e: MouseEvent) => {
      if (!held.current) return;
      e.preventDefault();
      e.stopPropagation();
      held.current = false;
    },
  };
}

const nearBottom = () => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - NEAR_BOTTOM_PX;
const toBottom = () => window.scrollTo({ top: document.documentElement.scrollHeight });

const noticeOf = (chat: ChatDetail) => {
  if (chat.canSend) return null;
  return chat.waiting ? `You can send more once ${chat.title} accepts your request.` : "You can't message this account.";
};

function Content({ message, onOpenPhoto }: { message: ShownMessage; onOpenPhoto: () => void }) {
  if (message.kind === "photo") {
    const photo = message.upload ?? message.photo;
    if (!photo) return null;
    const img = <img src={photo.url} width={photo.width} height={photo.height} alt="Photo" loading="lazy" decoding="async" draggable={false} />;
    return message.upload ? (
      <span className={styles.photo}>{img}</span>
    ) : (
      <button type="button" className={styles.photo} aria-label="Photo. Opens full screen" onClick={onOpenPhoto}>
        {img}
      </button>
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
  const camera = useRef<HTMLInputElement>(null);
  const trimmed = text.trim();
  const chosen = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (picked) onPhoto(picked);
  };

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
        <button type="button" className={styles.cameraButton} aria-label="Take a photo" onClick={() => camera.current?.click()}>
          <Icon name="camera" size={18} />
        </button>
        <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={chosen} />
        <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={chosen} />
        <textarea
          ref={input}
          className={styles.composerInput}
          value={text}
          maxLength={MESSAGE_TEXT_MAX}
          rows={1}
          placeholder="Message…"
          aria-label="Message"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          autoFocus
        />
        {trimmed ? (
          <button type="button" key="send" className={styles.sendButton} aria-label="Send" onClick={send}>
            <Icon name="send" size={18} />
          </button>
        ) : (
          <button type="button" key="photo" className={styles.composerIcon} aria-label="Send a photo from your device" onClick={() => file.current?.click()}>
            <Icon name="image" size={22} />
          </button>
        )}
      </div>
      {text.length > MESSAGE_TEXT_MAX - 100 && <p className={styles.charCount}>{`${text.length}/${MESSAGE_TEXT_MAX}`}</p>}
    </>
  );
}

interface LineProps {
  row: ThreadRow;
  isGroup: boolean;
  seen: boolean;
  fresh: boolean;
  onMenu: (message: ShownMessage) => void;
  onOpenPhoto: (message: ShownMessage) => void;
  onRetry: (message: ShownMessage) => void;
}

/** One message: bubbles in a run join up on the sender's side, and others' runs end with their photo, as in the app. */
function Line({ row, isGroup, seen, fresh, onMenu, onOpenPhoto, onRetry }: LineProps) {
  const { message: m, position } = row;
  const pending = !!m.sendState;
  const hold = useHold(() => !pending && onMenu(m));
  const opensRun = position === "single" || position === "first";
  const closesRun = position === "single" || position === "last";

  return (
    <li className={styles.line} data-mine={m.mine || undefined} data-pos={position} data-fresh={fresh || undefined} data-state={m.sendState}>
      {isGroup && !m.mine && opensRun && m.sender && <span className={styles.sender}>{m.sender.name}</span>}
      <span className={styles.bubbleRow} title={exact(m.createdAt)}>
        {!m.mine && <span className={styles.lineAvatar}>{closesRun && m.sender && <Avatar name={m.sender.name} url={m.sender.avatarUrl} size={AVATAR} />}</span>}
        <span className={styles.hold} {...hold}>
          <Content message={m} onOpenPhoto={() => onOpenPhoto(m)} />
        </span>
        {!pending && (
          <button type="button" className={styles.lineAction} aria-label="Message options" onClick={() => onMenu(m)}>
            <Icon name="more" size={18} />
          </button>
        )}
      </span>
      {m.sendState === "failed" && (
        <button type="button" className={styles.retry} onClick={() => onRetry(m)}>
          Not sent. Retry
        </button>
      )}
      {seen && <span className={styles.note}>Seen</span>}
    </li>
  );
}

/** A chat: newest at the bottom, polled every 3 seconds. Tap a photo to see it full screen; hold, right-click or ⋯ for a message's menu. */
export function ThreadScreen({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const thread = useThread(id);
  const { chat, messages } = thread;
  const [menuFor, setMenuFor] = useState<ShownMessage | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const [deciding, setDeciding] = useState<"accept" | "decline" | null>(null);
  // Messages newer than what was there when the chat opened slide in; the history doesn't.
  const [openedWith, setOpenedWith] = useState<string | null>(null);
  if (openedWith === null && !thread.loading) setOpenedWith(messages.at(-1)?.createdAt ?? "");
  const rows = useMemo(() => layoutThread(messages), [messages]);
  const withPhotos = useMemo(() => messages.filter((m) => m.photo), [messages]);
  const photos = useMemo(() => withPhotos.map((m) => ({ ...m.photo!, smaller: [] })), [withPhotos]);
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
  const openPhoto = (m: ShownMessage) => setViewing(Math.max(0, withPhotos.indexOf(m)));
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
        {rows.map((row) => {
          const m = row.message;
          const key = m.key ?? m.id;
          const fresh = !!m.sendState || (openedWith !== null && m.createdAt > openedWith);
          const stamp = row.header ? (
            <li key={`${key}-stamp`} className={styles.stamp}>
              {row.header}
            </li>
          ) : null;
          if (m.kind === "event") {
            return [
              stamp,
              <li key={key} className={styles.event} data-fresh={fresh || undefined}>
                {m.text}
              </li>,
            ];
          }
          return [
            stamp,
            <Line
              key={key}
              row={row}
              isGroup={isGroup}
              seen={m.id === seenId}
              fresh={fresh}
              onMenu={setMenuFor}
              onOpenPhoto={openPhoto}
              onRetry={thread.retry}
            />,
          ];
        })}
      </ol>

      {menuFor && <MessageMenu message={menuFor} onClose={() => setMenuFor(null)} onUnsend={async (m) => report(await thread.unsend(m))} />}
      {viewing !== null && <Lightbox photos={photos} start={viewing} onClose={() => setViewing(null)} />}

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
