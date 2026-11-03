"use client";

import { useEffect } from "react";
import { Composer } from "@/components/social/Composer";
import { Empty, PostList } from "@/components/social/PostList";
import { useMe, useOnSignedOut } from "@/components/social/session";
import { usePages } from "@/components/social/use-pages";
import { feed } from "@/lib/api/social";
import styles from "@/components/social/social.module.css";

/** Everyone's posts, newest first, with a composer on top. Signed in only. */
export function FeedScreen() {
  const me = useMe();
  const onSignedOut = useOnSignedOut();
  const pages = usePages(feed);
  const { error, setItems } = pages;

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  return (
    <div className={styles.column}>
      <h1 className="sr-only">Feed</h1>
      {me && <Composer me={me} onPosted={(post) => setItems((list) => [post, ...list])} />}
      <PostList
        pages={pages}
        empty={
          <Empty title="Nothing here yet">
            <p>Be the first to post something. It shows up here for everyone on Ruxstar.</p>
          </Empty>
        }
      />
    </div>
  );
}
