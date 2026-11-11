"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Button, Icon } from "@/components/ui";
import { formError } from "@/lib/api/account";
import type { Post } from "@/lib/api/social";
import { compact } from "@/lib/time";
import { useNearEnd, type usePages } from "./use-pages";
import shared from "./social.module.css";
import styles from "./PostGrid.module.css";

type Pages = ReturnType<typeof usePages<Post>>;

/** Square tiles, three to a row, each opening the post. Scrolls endlessly. */
export function PostGrid({ pages, empty }: { pages: Pages; empty: ReactNode }) {
  const { items, loading, loadingMore, hasMore, error, more, reload } = pages;
  const sentinel = useNearEnd(more, hasMore && !error);

  if (loading) return <Skeleton count={6} />;

  if (error && items.length === 0) {
    return (
      <div className={shared.failed} role="alert">
        <p>{formError(error).message}</p>
        <Button variant="secondary" onClick={reload}>
          Try again
        </Button>
      </div>
    );
  }

  if (items.length === 0) return <>{empty}</>;

  return (
    <>
      <ul className={styles.grid}>
        {items.map((post, i) => (
          <li key={post.id}>
            <Tile post={post} eager={i < 6} />
          </li>
        ))}
      </ul>
      {hasMore && <div ref={sentinel} className={shared.sentinel} aria-hidden />}
      {loadingMore && <Skeleton count={3} />}
      {error !== null && items.length > 0 && (
        <div className={shared.moreFailed}>
          <Button variant="secondary" onClick={more}>
            Load more
          </Button>
        </div>
      )}
    </>
  );
}

function Tile({ post, eager }: { post: Post; eager: boolean }) {
  const photo = post.media[0];
  const { likes, comments } = post.counts;
  const label = `${post.text.trim() || (post.media.length > 1 ? `${post.media.length} photos` : "Photo")}. ${likes} ${likes === 1 ? "like" : "likes"}, ${comments} ${comments === 1 ? "comment" : "comments"}`;
  return (
    <Link href={`/p/${post.id}`} className={styles.tile} aria-label={label}>
      {photo ? (
        <img src={photo.url} alt="" width={photo.width} height={photo.height} loading={eager ? "eager" : "lazy"} decoding="async" />
      ) : (
        <p className={styles.text}>{post.text}</p>
      )}
      {post.media.length > 1 && (
        <span className={styles.multiple}>
          <Icon name="stack" size={20} />
        </span>
      )}
      <span className={styles.overlay} aria-hidden>
        <span>
          <Icon name="heart" size={20} filled />
          {compact(likes)}
        </span>
        <span>
          <Icon name="comment" size={20} filled />
          {compact(comments)}
        </span>
      </span>
    </Link>
  );
}

function Skeleton({ count }: { count: number }) {
  return (
    <ul className={styles.grid} aria-busy aria-label="Loading posts">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className={styles.skeleton} />
      ))}
    </ul>
  );
}
