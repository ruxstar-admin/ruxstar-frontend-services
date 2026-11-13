"use client";

import { useLayoutEffect, useRef } from "react";
import { Icon, useToast } from "@/components/ui";
import type { ShownMessage } from "@/lib/api/chats";
import { stampLabel } from "./thread-layout";
import styles from "./chat.module.css";

/** The quick reactions, as on Instagram. Same as the app. */
export const QUICK_REACTIONS = ["❤️", "😂", "😮", "😢", "🔥", "👍"];

interface MessageMenuProps {
  message: ShownMessage;
  /** False in a request you haven't accepted. */
  canRespond: boolean;
  onClose: () => void;
  onReact: (message: ShownMessage, emoji: string) => void;
  onReply: (message: ShownMessage) => void;
  onUnsend: (message: ShownMessage) => void;
}

/** What you get when you hold or right-click a message: quick reactions, when it was sent, Reply, Copy, and Unsend for your own. Same as the app. */
export function MessageMenu({ message, canRespond, onClose, onReact, onReply, onUnsend }: MessageMenuProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const toast = useToast();
  const mineEmoji = message.reactions.find((r) => r.mine)?.emoji;

  useLayoutEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.text ?? "");
      toast("Copied");
    } catch {
      toast("Couldn't copy. Select the text and copy it instead.", "danger");
    }
    onClose();
  };

  const choose = (next: () => void) => {
    onClose();
    next();
  };

  return (
    <dialog
      ref={dialog}
      className={`${styles.dialog} ${styles.menu}`}
      aria-label="Message options"
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={styles.menuBody}>
        {canRespond && (
          <div className={styles.menuReactions} role="group" aria-label="React">
            {QUICK_REACTIONS.map((emoji, i) => (
              <button
                key={emoji}
                type="button"
                className={styles.menuReaction}
                aria-label={mineEmoji === emoji ? `Remove ${emoji}` : `React ${emoji}`}
                aria-pressed={mineEmoji === emoji}
                onClick={() => choose(() => onReact(message, emoji))}
                autoFocus={i === 0}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
        <p className={styles.menuTitle}>{`Sent ${stampLabel(message.createdAt)}`}</p>
        {canRespond && (
          <button type="button" className={styles.menuItem} onClick={() => choose(() => onReply(message))}>
            <Icon name="reply" size={20} />
            Reply
          </button>
        )}
        {message.text && (
          <button type="button" className={styles.menuItem} onClick={copy} autoFocus={!canRespond}>
            <Icon name="copy" size={20} />
            Copy text
          </button>
        )}
        {message.mine && (
          <button type="button" className={styles.menuItem} data-danger onClick={() => choose(() => onUnsend(message))}>
            <Icon name="undo" size={20} />
            <span className={styles.menuText}>
              Unsend
              <span className={styles.menuHint}>Removes it for everyone in this chat</span>
            </span>
          </button>
        )}
      </div>
    </dialog>
  );
}
