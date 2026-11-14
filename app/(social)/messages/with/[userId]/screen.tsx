"use client";

import { useEffect, useState } from "react";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { Button } from "@/components/ui";
import { formError } from "@/lib/api/account";
import { startDm, type ChatDetail } from "@/lib/api/chats";
import { ThreadScreen, ThreadSkeleton } from "../../[id]/thread";
import social from "@/components/social/social.module.css";

/**
 * Message from someone's profile: the page opens at once and the API finds your chat with them, or starts it, then it
 * becomes that chat (the address changes to it). Same as the app.
 */
export function StartChatScreen({ userId }: { userId: string }) {
  const onSignedOut = useOnSignedOut();
  const [chat, setChat] = useState<ChatDetail | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    startDm(userId).then(
      (started) => {
        if (!live) return;
        window.history.replaceState(null, "", `/messages/${started.id}`);
        setChat(started);
      },
      (err) => {
        if (live && !onSignedOut(err)) setError(err);
      },
    );
    return () => {
      live = false;
    };
  }, [userId, attempt, onSignedOut]);

  if (chat) return <ThreadScreen id={chat.id} initial={chat} />;
  if (!error) return <ThreadSkeleton />;
  return (
    <div className={social.column}>
      <Empty title="Could not open this chat">
        <p>{formError(error).message}</p>
        <Button
          variant="secondary"
          onClick={() => {
            setError(null);
            setAttempt((n) => n + 1);
          }}
        >
          Try again
        </Button>
      </Empty>
    </div>
  );
}
