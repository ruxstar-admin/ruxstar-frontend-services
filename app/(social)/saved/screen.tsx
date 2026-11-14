"use client";

import { useEffect } from "react";
import { Button, ButtonLink, Icon } from "@/components/ui";
import { Empty, PostList } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { usePages } from "@/components/social/use-pages";
import { savedPosts } from "@/lib/api/social";
import styles from "@/components/social/social.module.css";

/** Posts you saved, most recently saved first. Unsaving keeps the card until you leave, so a slip is easy to undo. */
export function SavedScreen() {
  const onSignedOut = useOnSignedOut();
  const pages = usePages(savedPosts);
  const { error, reload } = pages;

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  return (
    <div className={styles.column}>
      <div className={styles.headRow}>
        <div>
          <h1 className={styles.title}>Saved</h1>
          <p className={styles.subtitle}>Only you can see what you save.</p>
        </div>
        <Button variant="ghost" aria-label="Refresh saved posts" onClick={reload}>
          <Icon name="refresh" size={18} />
        </Button>
      </div>
      <PostList
        pages={pages}
        empty={
          <Empty title="Nothing saved yet">
            <p>Tap the bookmark on any post to keep it here.</p>
            <ButtonLink href="/feed" variant="secondary">
              Go to feed
            </ButtonLink>
          </Empty>
        }
      />
    </div>
  );
}
