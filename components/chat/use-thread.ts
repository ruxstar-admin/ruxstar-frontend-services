"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, newIdempotencyKey } from "@/lib/api/client";
import {
  CHAT_PHOTO_SIDE,
  chatMessages,
  chatUpdates,
  getChat,
  reactTo,
  readChat,
  sendMessage,
  sendPhoto,
  sendTyping,
  sendVoice,
  unreact,
  unsendMessage,
  UPDATES_WAIT_S,
  type ChatDetail,
  type ChatUpdates,
  type ShownMessage,
  type Typist,
} from "@/lib/api/chats";
import { shrinkPhoto } from "@/lib/photo";
import { applyUpdated, confirmSent, dropUnsent, mergeIncoming, mergeOlder, withMyReaction } from "./merge";
import { quoteOf } from "./thread-layout";
import type { VoiceRecording } from "./use-voice-recorder";

/** After a failed check, wait this long before the next. */
const RETRY_MS = 3000;
/** Someone shows as typing… this long after the last answer that said so. */
const TYPING_SHOWN_MS = 6500;
/** While you type, "still typing" goes out this often, and stops after this long without a keystroke. */
const TYPING_REFRESH_MS = 4000;
const TYPING_IDLE_MS = 5000;

const visible = () => document.visibilityState === "visible";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One chat: its details and messages. While the page is in view it keeps one /updates call open, which answers
 * the moment anything changes (new messages, unsent ones, reactions, typing, Seen, changes to a group). Sends
 * at once on screen: a failed send stays with Retry, which reuses its idempotency key, so nothing is sent twice.
 * `initial` is the chat's details when the caller already has them, so the first load only fetches messages.
 */
export function useThread(chatId: string, initial?: ChatDetail) {
  const [chat, setChat] = useState<ChatDetail | null>(initial ?? null);
  const [messages, setMessages] = useState<ShownMessage[]>([]);
  const [typing, setTyping] = useState<Typist[]>([]);
  const [olderCursor, setOlderCursor] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const since = useRef<string | null>(null);
  const latest = useRef<ShownMessage[]>([]);
  const files = useRef(new Map<string, Blob>());
  const counter = useRef(0);
  const typingTimer = useRef<number | null>(null);

  useEffect(() => {
    latest.current = messages;
  }, [messages]);

  const markRead = useCallback(() => {
    if (visible()) readChat(chatId).catch(() => undefined);
  }, [chatId]);

  const refreshChat = useCallback(() => {
    getChat(chatId).then(setChat, () => undefined);
  }, [chatId]);

  useEffect(() => {
    let live = true;
    since.current = null;
    const known = attempt === 0 && initial?.id === chatId ? initial : undefined;
    Promise.all([known ?? getChat(chatId), chatMessages(chatId)])
      .then(([detail, page]) => {
        if (!live) return;
        setChat(detail);
        setMessages([...page.items].reverse());
        setOlderCursor(page.nextCursor);
        since.current = page.items[0]?.createdAt ?? detail.createdAt;
        setError(null);
        setLoading(false);
        markRead();
      })
      .catch((err) => {
        if (!live) return;
        setError(err);
        setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [chatId, attempt, markRead, initial]);

  const apply = useCallback(
    (update: ChatUpdates) => {
      since.current = update.now;
      const known = new Set(latest.current.map((m) => m.id));
      const fromOthers = update.messages.some((m) => !m.mine && !known.has(m.id));
      setMessages((prev) => dropUnsent(applyUpdated(mergeIncoming(prev, update.messages), update.updated), update.unsent));
      setChat((prev) =>
        prev && (prev.seenAt !== update.seenAt || prev.activeAt !== update.activeAt) ? { ...prev, seenAt: update.seenAt, activeAt: update.activeAt } : prev,
      );
      setTyping((prev) => (prev.length === 0 && update.typing.length === 0 ? prev : update.typing));
      if (typingTimer.current !== null) window.clearTimeout(typingTimer.current);
      if (update.typing.length) typingTimer.current = window.setTimeout(() => setTyping([]), TYPING_SHOWN_MS);
      if (update.changed) refreshChat();
      if (fromOthers) markRead();
    },
    [refreshChat, markRead],
  );

  // One waiting call at a time while the page is in view; a hidden tab waits until it's shown again.
  useEffect(() => {
    let active = true;
    let controller: AbortController | null = null;
    let wake: (() => void) | null = null;
    const pause = (ms?: number) =>
      new Promise<void>((resolve) => {
        wake = resolve;
        if (ms !== undefined) window.setTimeout(resolve, ms);
      });
    const onVisible = () => visible() && wake?.();
    document.addEventListener("visibilitychange", onVisible);
    (async () => {
      while (active) {
        if (!since.current) {
          await pause(300);
          continue;
        }
        if (!visible()) {
          await pause();
          continue;
        }
        controller = new AbortController();
        try {
          const update = await chatUpdates(chatId, since.current, UPDATES_WAIT_S, controller.signal);
          if (active) apply(update);
        } catch {
          if (active) await sleep(RETRY_MS);
        }
      }
    })();
    return () => {
      active = false;
      controller?.abort();
      wake?.();
      document.removeEventListener("visibilitychange", onVisible);
      if (typingTimer.current !== null) window.clearTimeout(typingTimer.current);
    };
  }, [chatId, apply]);

  // Telling the others you're typing.
  const typingSince = useRef(0);
  const typingIdle = useRef<number | null>(null);
  const stopTyping = useCallback(
    (tell = true) => {
      if (typingIdle.current !== null) window.clearTimeout(typingIdle.current);
      typingIdle.current = null;
      if (typingSince.current && tell) sendTyping(chatId, false).catch(() => undefined);
      typingSince.current = 0;
    },
    [chatId],
  );
  const noteTyping = useCallback(
    (draft: string) => {
      if (!draft.trim()) return stopTyping();
      if (Date.now() - typingSince.current > TYPING_REFRESH_MS) {
        typingSince.current = Date.now();
        sendTyping(chatId, true).catch(() => undefined);
      }
      if (typingIdle.current !== null) window.clearTimeout(typingIdle.current);
      typingIdle.current = window.setTimeout(() => stopTyping(), TYPING_IDLE_MS);
    },
    [chatId, stopTyping],
  );
  useEffect(() => () => stopTyping(), [stopTyping]);

  const fail = (id: string) => setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, sendState: "failed" as const } : m)));

  const deliver = async (message: ShownMessage) => {
    const key = message.key!;
    const replyToId = message.replyTo?.id;
    try {
      const file = files.current.get(message.id);
      const saved =
        message.kind === "voice" && file && message.recording
          ? await sendVoice(chatId, file, message.recording, key, replyToId)
          : file
            ? await sendPhoto(chatId, file, key, replyToId)
            : await sendMessage(chatId, { text: message.text, replyToId }, key);
      files.current.delete(message.id);
      if (message.upload) URL.revokeObjectURL(message.upload.url);
      if (message.recording) URL.revokeObjectURL(message.recording.url);
      // A first message, or a reply to a request, changes what this chat allows next.
      const firstFromMe = !latest.current.some((m) => m.mine && !m.sendState && m.kind !== "event");
      setMessages((prev) => confirmSent(prev, message.id, saved));
      if (firstFromMe || chat?.state === "request") refreshChat();
      return null;
    } catch (err) {
      fail(message.id);
      if (err instanceof ApiError && (err.code === "CHAT_REQUEST_PENDING" || err.status === 403 || err.status === 404)) refreshChat();
      return err;
    }
  };

  const draft = (fields: Partial<ShownMessage>, replyTo?: ShownMessage | null): ShownMessage => ({
    id: `tmp-${++counter.current}`,
    chatId,
    kind: "text",
    sender: null,
    mine: true,
    text: "",
    post: null,
    photo: null,
    voice: null,
    replyTo: replyTo ? quoteOf(replyTo) : null,
    reactions: [],
    createdAt: new Date().toISOString(),
    sendState: "sending",
    key: newIdempotencyKey(),
    ...fields,
  });

  /** Resolves with the error when it fails, or null. */
  const send = (text: string, replyTo?: ShownMessage | null) => {
    stopTyping(false);
    const message = draft({ text }, replyTo);
    setMessages((prev) => [...prev, message]);
    return deliver(message);
  };

  const sendFile = async (file: File, replyTo?: ShownMessage | null) => {
    let photo: Blob;
    try {
      photo = await shrinkPhoto(file, CHAT_PHOTO_SIDE);
    } catch {
      return new ApiError(422, "PHOTO_INVALID", "That file isn't a photo we can read. Try a JPG or PNG.");
    }
    const bitmap = await createImageBitmap(photo);
    const message = draft({ kind: "photo", upload: { url: URL.createObjectURL(photo), width: bitmap.width, height: bitmap.height } }, replyTo);
    bitmap.close();
    files.current.set(message.id, photo);
    setMessages((prev) => [...prev, message]);
    return deliver(message);
  };

  const sendRecording = (recording: VoiceRecording, replyTo?: ShownMessage | null) => {
    const message = draft(
      { kind: "voice", recording: { url: URL.createObjectURL(recording.blob), durationMs: recording.durationMs, levels: recording.levels } },
      replyTo,
    );
    files.current.set(message.id, recording.blob);
    setMessages((prev) => [...prev, message]);
    return deliver(message);
  };

  const retry = (message: ShownMessage) => {
    if ((message.kind === "photo" || message.kind === "voice") && !files.current.has(message.id)) return;
    setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, sendState: "sending" as const } : m)));
    deliver({ ...message, sendState: "sending" });
  };

  /** Gone for everyone. One that never reached the server is just dropped. */
  const unsend = async (message: ShownMessage) => {
    setMessages((prev) => prev.filter((m) => m.id !== message.id));
    files.current.delete(message.id);
    if (message.sendState) {
      if (message.upload) URL.revokeObjectURL(message.upload.url);
      if (message.recording) URL.revokeObjectURL(message.recording.url);
      return null;
    }
    try {
      await unsendMessage(chatId, message.id);
      return null;
    } catch (err) {
      setMessages((prev) => mergeIncoming(prev, [message]).sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
      return err;
    }
  };

  /** Sets your reaction, or takes it back when it's the one you already gave. Shows at once; undone if the API says no. */
  const react = async (message: ShownMessage, emoji: string) => {
    if (message.sendState || message.kind === "event") return null;
    const takeBack = message.reactions.some((r) => r.mine && r.emoji === emoji);
    const before = message.reactions;
    const set = (reactions: ShownMessage["reactions"]) => setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, reactions } : m)));
    set(withMyReaction(before, emoji));
    try {
      const saved = takeBack ? await unreact(chatId, message.id) : await reactTo(chatId, message.id, emoji);
      setMessages((prev) => applyUpdated(prev, [saved]));
      return null;
    } catch (err) {
      set(before);
      return err;
    }
  };

  const loadOlder = () => {
    if (!olderCursor || loadingOlder) return Promise.resolve();
    setLoadingOlder(true);
    return chatMessages(chatId, olderCursor)
      .then((page) => {
        setMessages((prev) => mergeOlder(prev, page.items));
        setOlderCursor(page.nextCursor);
      })
      .catch(() => undefined)
      .finally(() => setLoadingOlder(false));
  };

  const reload = () => {
    setLoading(true);
    setError(null);
    setAttempt((n) => n + 1);
  };

  return {
    chat,
    setChat,
    refreshChat,
    messages,
    typing,
    loading,
    error,
    reload,
    send,
    sendFile,
    sendRecording,
    retry,
    unsend,
    react,
    noteTyping,
    loadOlder,
    hasOlder: olderCursor !== null,
    loadingOlder,
  };
}
