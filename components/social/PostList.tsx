"use client";

import { useCallback, type ReactNode } from "react";
import { Button } from "@/components/ui";
import { formError } from "@/lib/api/account";
import type { Post } from "@/lib/api/social";
import { PostCard, PostSkeleton } from "./PostCard";
import { useNearEnd, type usePages } from "./use-pages";
import styles from "./social.module.css";

type Pages = ReturnType<typeof usePages<Post>>;

/** Posts with endless scroll. Edits and deletes from a card update the list in place. */
export function PostList({ pages, empty }: { pages: Pages; empty: ReactNode }) {
  const { items, setItems, loading, loadingMore, hasMore, error, more, reload } = pages;
  const sentinel = useNearEnd(more, hasMore && !error);

  const change = useCallback((post: Post) => setItems((list) => list.map((p) => (p.id === post.id ? post : p))), [setItems]);
  const remove = useCallback((id: string) => setItems((list) => list.filter((p) => p.id !== id)), [setItems]);

  if (loading) {
    return (
      <div aria-busy>
        <PostSkeleton />
        <PostSkeleton />
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div className={styles.failed} role="alert">
        <p>{formError(error).message}</p>
        <Button variant="secondary" onClick={reload}>
          Try again
        </Button>
      </div>
    );
  }

  if (items.length === 0) return <>{empty}</>;

  return (
    <div>
      {items.map((post, i) => (
        <PostCard key={post.id} post={post} onChange={change} onRemove={remove} eager={i < 2} />
      ))}
      {hasMore && <div ref={sentinel} className={styles.sentinel} aria-hidden />}
      {loadingMore && <PostSkeleton />}
      {error !== null && items.length > 0 && (
        <div className={styles.moreFailed}>
          <Button variant="secondary" onClick={more}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className={styles.empty}>
      <p className={styles.emptyTitle}>{title}</p>
      {children && <div className={styles.emptyBody}>{children}</div>}
    </div>
  );
}
