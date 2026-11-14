"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { ChatAvatar } from "@/components/chat/ChatAvatar";
import { seenMessageId } from "@/components/chat/merge";
import { MessageMenu } from "@/components/chat/MessageMenu";
import { activeLabel, clockOf, layoutThread, quoteOf, type ThreadRow } from "@/components/chat/thread-layout";
import { useThread } from "@/components/chat/use-thread";
import { useVoiceRecorder, type VoiceRecording } from "@/components/chat/use-voice-recorder";
import { VoiceNote } from "@/components/chat/VoiceNote";
import { Avatar } from "@/components/profile/Avatar";
import { Lightbox } from "@/components/social/Lightbox";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { Button, Icon, Skeleton, useToast } from "@/components/ui";
import { formError } from "@/lib/api/account";
import { acceptChat, declineChat, MESSAGE_TEXT_MAX, type ChatDetail, type ShownMessage, type Typist } from "@/lib/api/chats";
import { exact } from "@/lib/time";
import styles from "@/components/chat/chat.module.css";
import social from "@/components/social/social.module.css";

const NEAR_BOTTOM_PX = 240;
/** Holding a message this long on a touch screen opens its menu, as in the app. */
const HOLD_MS = 450;
const SLOP_PX = 10;
/** Two taps closer together than this are a double tap. */
const DOUBLE_TAP_MS = 300;
/** Swipe a message right this far to reply to it, as in the app. */
const REPLY_AT_PX = 56;
const SWIPE_MAX_PX = 80;
const AVATAR = 28;

interface Gestures {
  onHold: () => void;
  onDouble: () => void;
  onSwipe: () => void;
}

/**
 * The app's message gestures on the web. Touch: hold for the menu, double-tap to ❤️, swipe right to reply.
 * Mouse: right-click for the menu, double-click to ❤️ (the ⋯ and reply buttons do the rest).
 */
function useGestures({ onHold, onDouble, onSwipe }: Gestures) {
  const timer = useRef<number | null>(null);
  const start = useRef({ x: 0, y: 0 });
  const held = useRef(false);
  const swiping = useRef(false);
  const lastTap = useRef(0);
  const pointer = useRef("mouse");
  const [shift, setShift] = useState(0);
  const cancel = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => cancel, []);

  const handlers = {
    onPointerDown: (e: PointerEvent) => {
      held.current = false;
      swiping.current = false;
      pointer.current = e.pointerType;
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
      if (e.pointerType === "mouse" || held.current) return;
      const dx = e.clientX - start.current.x;
      const dy = e.clientY - start.current.y;
      if (Math.hypot(dx, dy) > SLOP_PX) cancel();
      if (!swiping.current && dx > SLOP_PX && Math.abs(dx) > Math.abs(dy) * 1.5) swiping.current = true;
      if (swiping.current) setShift(Math.min(SWIPE_MAX_PX, Math.max(0, dx * 0.7)));
    },
    onPointerUp: (e: PointerEvent) => {
      cancel();
      if (swiping.current) {
        if (shift >= REPLY_AT_PX) onSwipe();
        setShift(0);
        return;
      }
      if (e.pointerType === "mouse" || held.current) return;
      const now = Date.now();
      if (now - lastTap.current < DOUBLE_TAP_MS) {
        lastTap.current = 0;
        onDouble();
      } else {
        lastTap.current = now;
      }
    },
    onPointerCancel: () => {
      cancel();
      swiping.current = false;
      setShift(0);
    },
    onContextMenu: (e: MouseEvent) => {
      e.preventDefault();
      cancel();
      if (!held.current) onHold();
    },
    onDoubleClick: () => {
      // Touch screens fire this after a double tap too, which onPointerUp already handled.
      if (pointer.current !== "mouse") return;
      window.getSelection()?.removeAllRanges();
      onDouble();
    },
    /** A tap that ended a hold or a swipe mustn't also open the photo or post. */
    onClickCapture: (e: MouseEvent) => {
      if (!held.current && !swiping.current) return;
      e.preventDefault();
      e.stopPropagation();
      held.current = false;
      swiping.current = false;
    },
  };
  return { handlers, shift };
}

const nearBottom = () => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - NEAR_BOTTOM_PX;
const toBottom = () => window.scrollTo({ top: document.documentElement.scrollHeight });

const noticeOf = (chat: ChatDetail) => {
  if (chat.canSend) return null;
  return chat.waiting ? `You can send more once ${chat.title} accepts your request.` : "You can't message this account.";
};

/** The time now, moving on each minute, so "Active 5m ago" stays right while the chat is open. */
function useMinute() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

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
  if (message.kind === "voice") {
    const voice = message.voice ?? message.recording;
    if (!voice) return null;
    return (
      <span className={styles.bubble}>
        <VoiceNote url={voice.url} durationMs={voice.durationMs} levels={voice.levels} />
      </span>
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

function RecordingBar({ durationMs, live, onCancel, onSend }: { durationMs: number; live: number[]; onCancel: () => void; onSend: () => void }) {
  return (
    <div className={`${styles.composer} ${styles.recordingBar}`}>
      <button type="button" className={styles.composerIcon} aria-label="Delete recording" onClick={onCancel}>
        <Icon name="trash" size={20} />
      </button>
      <span className={styles.recordingDot} aria-hidden />
      <span className={styles.recordingTime} aria-live="polite">
        {clockOf(durationMs)}
      </span>
      <span className={styles.recordingLive} aria-hidden>
        {live.map((level, i) => (
          <span key={i} style={{ height: `${Math.max(3, (level / 100) * 24)}px` }} />
        ))}
      </span>
      <button type="button" className={styles.sendButton} aria-label="Send voice message" onClick={onSend} autoFocus>
        <Icon name="send" size={18} />
      </button>
    </div>
  );
}

interface ComposerProps {
  onSend: (text: string) => void;
  onPhoto: (file: File) => void;
  onVoice: (recording: VoiceRecording) => void;
  onTyping: (draft: string) => void;
  replyingTo: ShownMessage | null;
  onCancelReply: () => void;
  onError: (message: string) => void;
}

function Composer({ onSend, onPhoto, onVoice, onTyping, replyingTo, onCancelReply, onError }: ComposerProps) {
  const [text, setText] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const voice = useVoiceRecorder(onVoice);
  const trimmed = text.trim();
  const quote = replyingTo ? quoteOf(replyingTo) : null;
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

  useEffect(() => {
    if (replyingTo) input.current?.focus();
  }, [replyingTo]);

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
    } else if (event.key === "Escape" && replyingTo) {
      onCancelReply();
    }
  };

  const record = async () => {
    if ((await voice.start()) === "unsupported") onError("Voice messages can't be recorded in this browser.");
  };

  const finishVoice = async () => {
    const done = await voice.stop();
    if (done) onVoice(done);
    else onError("That was too short to send. Tap the mic and talk a little longer.");
    input.current?.focus();
  };

  return (
    <>
      {quote && (
        <div className={styles.replying}>
          <span className={styles.replyingText}>
            <span className={styles.replyingLabel}>{quote.mine ? "Replying to yourself" : `Replying to ${quote.sender}`}</span>
            <span className={styles.replyingQuote}>{quote.text}</span>
          </span>
          <button type="button" className={styles.iconButton} aria-label="Cancel reply" onClick={onCancelReply}>
            <Icon name="close" size={18} />
          </button>
        </div>
      )}
      {voice.denied && <p className={styles.notice}>Microphone access is blocked for this site. Allow it in your browser to send voice messages.</p>}
      {voice.recording ? (
        <RecordingBar durationMs={voice.durationMs} live={voice.live} onCancel={voice.cancel} onSend={finishVoice} />
      ) : (
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
            onChange={(e) => {
              setText(e.target.value);
              onTyping(e.target.value);
            }}
            onKeyDown={onKeyDown}
            autoFocus
          />
          {trimmed ? (
            <button type="button" key="send" className={styles.sendButton} aria-label="Send" onClick={send}>
              <Icon name="send" size={18} />
            </button>
          ) : (
            <span key="tools" className={styles.composerTools}>
              {voice.supported && (
                <button type="button" className={styles.composerIcon} aria-label="Record a voice message" onClick={record}>
                  <Icon name="mic" size={22} />
                </button>
              )}
              <button type="button" className={styles.composerIcon} aria-label="Send a photo from your device" onClick={() => file.current?.click()}>
                <Icon name="image" size={22} />
              </button>
            </span>
          )}
        </div>
      )}
      {text.length > MESSAGE_TEXT_MAX - 100 && <p className={styles.charCount}>{`${text.length}/${MESSAGE_TEXT_MAX}`}</p>}
    </>
  );
}

interface LineProps {
  row: ThreadRow;
  isGroup: boolean;
  seen: boolean;
  fresh: boolean;
  canRespond: boolean;
  onMenu: (message: ShownMessage) => void;
  onReact: (message: ShownMessage, emoji: string) => void;
  onReply: (message: ShownMessage) => void;
  onOpenPhoto: (message: ShownMessage) => void;
  onRetry: (message: ShownMessage) => void;
}

const replyLabel = (m: ShownMessage) => {
  const to = m.replyTo!;
  if (m.mine) return to.mine ? "You replied to yourself" : `You replied to ${to.sender}`;
  return to.mine ? "Replied to you" : `Replied to ${to.sender}`;
};

/** One message: bubbles in a run join up on the sender's side, and others' runs end with their photo, as in the app. */
function Line({ row, isGroup, seen, fresh, canRespond, onMenu, onReact, onReply, onOpenPhoto, onRetry }: LineProps) {
  const { message: m, position } = row;
  const pending = !!m.sendState;
  const responds = canRespond && !pending;
  const { handlers, shift } = useGestures({
    onHold: () => !pending && onMenu(m),
    onDouble: () => responds && onReact(m, "❤️"),
    onSwipe: () => responds && onReply(m),
  });
  const opensRun = position === "single" || position === "first";
  const closesRun = position === "single" || position === "last";
  const total = m.reactions.reduce((sum, r) => sum + r.count, 0);

  return (
    <li className={styles.line} data-mine={m.mine || undefined} data-pos={position} data-fresh={fresh || undefined} data-state={m.sendState}>
      {isGroup && !m.mine && opensRun && m.sender && <span className={styles.sender}>{m.sender.name}</span>}
      {m.replyTo && (
        <span className={styles.quote}>
          <span className={styles.quoteLabel}>
            <Icon name="reply" size={12} />
            {replyLabel(m)}
          </span>
          <span className={styles.quoteBubble} data-gone={!m.replyTo.available || undefined}>
            {m.replyTo.available ? m.replyTo.text : "Message unsent"}
          </span>
        </span>
      )}
      <span className={styles.bubbleRow} title={exact(m.createdAt)}>
        {!m.mine && <span className={styles.lineAvatar}>{closesRun && m.sender && <Avatar name={m.sender.name} url={m.sender.avatarUrl} size={AVATAR} />}</span>}
        <span className={styles.swipeHint} style={{ opacity: Math.min(1, shift / REPLY_AT_PX) }} aria-hidden>
          <Icon name="reply" size={18} />
        </span>
        <span className={styles.hold} style={shift ? { transform: `translateX(${shift}px)` } : undefined} data-swiping={shift > 0 || undefined} {...handlers}>
          <Content message={m} onOpenPhoto={() => onOpenPhoto(m)} />
        </span>
        {!pending && (
          <span className={styles.lineActions}>
            {responds && (
              <button type="button" className={styles.lineAction} aria-label="Reply" onClick={() => onReply(m)}>
                <Icon name="reply" size={18} />
              </button>
            )}
            <button type="button" className={styles.lineAction} aria-label="Message options" onClick={() => onMenu(m)}>
              <Icon name="more" size={18} />
            </button>
          </span>
        )}
      </span>
      {total > 0 && (
        <button
          type="button"
          key={m.reactions.map((r) => `${r.emoji}${r.count}`).join()}
          className={styles.reactions}
          aria-label={`Reactions: ${m.reactions.map((r) => `${r.emoji} ${r.count}`).join(", ")}. Opens options`}
          onClick={() => onMenu(m)}
        >
          <span>{m.reactions.slice(0, 3).map((r) => r.emoji).join("")}</span>
          {total > 1 && <span className={styles.reactionCount}>{total}</span>}
        </button>
      )}
      {m.sendState === "failed" && (
        <button type="button" className={styles.retry} onClick={() => onRetry(m)}>
          Not sent. Retry
        </button>
      )}
      {seen && <span className={styles.note}>Seen</span>}
    </li>
  );
}

/** "typing…" as Instagram shows it: their photo and a bubble of three bouncing dots. */
function TypingLine({ people, isGroup }: { people: Typist[]; isGroup: boolean }) {
  const first = people[0];
  if (!first) return null;
  const label = people.length === 1 ? `${first.name} is typing` : `${people.length} people are typing`;
  return (
    <li className={styles.line} data-fresh aria-label={label}>
      {isGroup && <span className={styles.sender}>{people.length === 1 ? first.name : label}</span>}
      <span className={styles.bubbleRow}>
        <span className={styles.lineAvatar}>
          <Avatar name={first.name} url={first.avatarUrl} size={AVATAR} />
        </span>
        <span className={`${styles.bubble} ${styles.typing}`} aria-hidden>
          <span />
          <span />
          <span />
        </span>
      </span>
    </li>
  );
}

export function ThreadSkeleton() {
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

/**
 * A chat: newest at the bottom, live while the page is in view. Tap a photo to see it full screen; hold, right-click or ⋯ for a message's menu.
 * `initial` is the chat's details when the page already has them.
 */
export function ThreadScreen({ id, initial }: { id: string; initial?: ChatDetail }) {
  const router = useRouter();
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const thread = useThread(id, initial);
  const { chat, messages } = thread;
  const [menuFor, setMenuFor] = useState<ShownMessage | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const [deciding, setDeciding] = useState<"accept" | "decline" | null>(null);
  const [replyingTo, setReplyingTo] = useState<ShownMessage | null>(null);
  const now = useMinute();
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

  // Someone starting to type shows at the bottom; keep it in view if you were there.
  useLayoutEffect(() => {
    if (thread.typing.length && nearBottom()) toBottom();
  }, [thread.typing.length]);

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

  if (thread.loading) return <ThreadSkeleton />;
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
  const canRespond = chat.state === "active" && chat.canSend;
  const seenId = isGroup ? null : seenMessageId(messages, chat.seenAt);
  const typing = thread.typing;
  const typingLine = typing.length === 0 ? null : !isGroup ? "typing…" : typing.length > 1 ? `${typing.length} people are typing…` : `${typing[0].name} is typing…`;
  const subtitle = typingLine ?? (isGroup ? `${chat.members} people` : (activeLabel(chat.activeAt, now) ?? (chat.peer ? `@${chat.peer.username}` : "")));
  const openPhoto = (m: ShownMessage) => setViewing(Math.max(0, withPhotos.indexOf(m)));
  const notice = noticeOf(chat);
  const react = async (m: ShownMessage, emoji: string) => report(await thread.react(m, emoji));
  const take = <T,>(send: (value: T, replyTo: ShownMessage | null) => Promise<unknown>) => (value: T) => {
    const to = replyingTo;
    setReplyingTo(null);
    send(value, to).then(report);
  };

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
            {subtitle && (
              <span className={styles.headSub} data-live={typingLine ? true : undefined}>
                {subtitle}
              </span>
            )}
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
              canRespond={canRespond}
              onMenu={setMenuFor}
              onReact={react}
              onReply={setReplyingTo}
              onOpenPhoto={openPhoto}
              onRetry={thread.retry}
            />,
          ];
        })}
        <TypingLine people={typing} isGroup={isGroup} />
      </ol>

      {menuFor && (
        <MessageMenu
          message={menuFor}
          canRespond={canRespond}
          onClose={() => setMenuFor(null)}
          onReact={react}
          onReply={setReplyingTo}
          onUnsend={async (m) => {
            if (replyingTo?.id === m.id) setReplyingTo(null);
            report(await thread.unsend(m));
          }}
        />
      )}
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
          <Composer
            onSend={take(thread.send)}
            onPhoto={take(thread.sendFile)}
            onVoice={take(thread.sendRecording)}
            onTyping={thread.noteTyping}
            replyingTo={replyingTo}
            onCancelReply={() => setReplyingTo(null)}
            onError={(message) => toast(message, "danger")}
          />
        )}
      </div>
    </div>
  );
}
