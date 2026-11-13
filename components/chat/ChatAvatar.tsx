import { Avatar } from "@/components/profile/Avatar";
import { Icon } from "@/components/ui";
import type { Chat } from "@/lib/api/chats";
import styles from "./chat.module.css";

/** The other person's photo in a 1:1 chat, a people icon for a group. */
export function ChatAvatar({ chat, size = 44 }: { chat: Pick<Chat, "kind" | "title" | "peer">; size?: number }) {
  if (chat.kind === "dm") return <Avatar name={chat.title} url={chat.peer?.avatarUrl} size={size} />;
  return (
    <span className={styles.groupIcon} style={{ width: size, height: size }}>
      <Icon name="users" size={Math.round(size * 0.45)} />
    </span>
  );
}
