"use client";

import { useLayoutEffect, useRef } from "react";
import { Icon, useToast } from "@/components/ui";
import type { ShownMessage } from "@/lib/api/chats";
import { stampLabel } from "./thread-layout";
import styles from "./chat.module.css";

/** What you get when you hold or right-click a message: when it was sent, Copy, and Unsend for your own. Same as the app. */
export function MessageMenu({ message, onClose, onUnsend }: { message: ShownMessage; onClose: () => void; onUnsend: (message: ShownMessage) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const toast = useToast();

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

  return (
    <dialog
      ref={dialog}
      className={`${styles.dialog} ${styles.menu}`}
      aria-label="Message options"
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={styles.menuBody}>
        <p className={styles.menuTitle}>{`Sent ${stampLabel(message.createdAt)}`}</p>
        {message.text && (
          <button type="button" className={styles.menuItem} onClick={copy} autoFocus>
            <Icon name="copy" size={20} />
            Copy text
          </button>
        )}
        {message.mine && (
          <button
            type="button"
            className={styles.menuItem}
            data-danger
            onClick={() => {
              onClose();
              onUnsend(message);
            }}
          >
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
