"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, newIdempotencyKey } from "@/lib/api/client";
import {
  CHAT_PHOTO_SIDE,
  chatMessages,
  chatUpdates,
  getChat,
  readChat,
  sendMessage,
  sendPhoto,
  unsendMessage,
  type ChatDetail,
  type ShownMessage,
} from "@/lib/api/chats";
import { shrinkPhoto } from "@/lib/photo";
import { confirmSent, dropUnsent, mergeIncoming, mergeOlder } from "./merge";

const POLL_MS = 3000;

const visible = () => document.visibilityState === "visible";

/**
 * One chat: its details and messages. Polls every 3 seconds while the page is in view (new messages,
 * unsent ones, Seen, and changes to a group) and sends at once on screen: a failed send stays with
 * Retry, which reuses its idempotency key, so nothing is sent twice.
 */
export function useThread(chatId: string) {
  const [chat, setChat] = useState<ChatDetail | null>(null);
  const [messages, setMessages] = useState<ShownMessage[]>([]);
  const [olderCursor, setOlderCursor] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const since = useRef<string | null>(null);
  const polling = useRef(false);
  const latest = useRef<ShownMessage[]>([]);
  const photos = useRef(new Map<string, Blob>());
  const counter = useRef(0);

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
    Promise.all([getChat(chatId), chatMessages(chatId)])
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
  }, [chatId, attempt, markRead]);

  useEffect(() => {
    const poll = () => {
      if (!since.current || polling.current || !visible()) return;
      polling.current = true;
      chatUpdates(chatId, since.current)
        .then((update) => {
          since.current = update.now;
          const known = new Set(latest.current.map((m) => m.id));
          const fromOthers = update.messages.some((m) => !m.mine && !known.has(m.id));
          setMessages((prev) => dropUnsent(mergeIncoming(prev, update.messages), update.unsent));
          setChat((prev) => (prev && prev.seenAt !== update.seenAt ? { ...prev, seenAt: update.seenAt } : prev));
          if (update.changed) refreshChat();
          if (fromOthers) markRead();
        })
        .catch(() => undefined)
        .finally(() => {
          polling.current = false;
        });
    };
    const timer = setInterval(poll, POLL_MS);
    const onVisible = () => visible() && poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [chatId, refreshChat, markRead]);

  const fail = (id: string) => setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, sendState: "failed" as const } : m)));

  const deliver = async (message: ShownMessage) => {
    const key = message.key!;
    try {
      const photo = photos.current.get(message.id);
      const saved = photo ? await sendPhoto(chatId, photo, key) : await sendMessage(chatId, { text: message.text }, key);
      photos.current.delete(message.id);
      if (message.upload) URL.revokeObjectURL(message.upload.url);
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

  const draft = (fields: Partial<ShownMessage>): ShownMessage => ({
    id: `tmp-${++counter.current}`,
    chatId,
    kind: "text",
    sender: null,
    mine: true,
    text: "",
    post: null,
    photo: null,
    createdAt: new Date().toISOString(),
    sendState: "sending",
    key: newIdempotencyKey(),
    ...fields,
  });

  /** Resolves with the error when it fails, or null. */
  const send = (text: string) => {
    const message = draft({ text });
    setMessages((prev) => [...prev, message]);
    return deliver(message);
  };

  const sendFile = async (file: File) => {
    let photo: Blob;
    try {
      photo = await shrinkPhoto(file, CHAT_PHOTO_SIDE);
    } catch {
      return new ApiError(422, "PHOTO_INVALID", "That file isn't a photo we can read. Try a JPG or PNG.");
    }
    const bitmap = await createImageBitmap(photo);
    const message = draft({ kind: "photo", upload: { url: URL.createObjectURL(photo), width: bitmap.width, height: bitmap.height } });
    bitmap.close();
    photos.current.set(message.id, photo);
    setMessages((prev) => [...prev, message]);
    return deliver(message);
  };

  const retry = (message: ShownMessage) => {
    if (message.kind === "photo" && !photos.current.has(message.id)) return;
    setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, sendState: "sending" as const } : m)));
    deliver({ ...message, sendState: "sending" });
  };

  /** Gone for everyone. One that never reached the server is just dropped. */
  const unsend = async (message: ShownMessage) => {
    setMessages((prev) => prev.filter((m) => m.id !== message.id));
    photos.current.delete(message.id);
    if (message.sendState) {
      if (message.upload) URL.revokeObjectURL(message.upload.url);
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

  return { chat, setChat, refreshChat, messages, loading, error, reload, send, sendFile, retry, unsend, loadOlder, hasOlder: olderCursor !== null, loadingOlder };
}
