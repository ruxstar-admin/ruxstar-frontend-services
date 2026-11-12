"use client";

import { useState, type KeyboardEvent } from "react";
import { ButtonLink, Icon, type IconName } from "@/components/ui";
import { PostGrid } from "@/components/social/PostGrid";
import { Empty } from "@/components/social/PostList";
import { useMe } from "@/components/social/session";
import { usePages } from "@/components/social/use-pages";
import { userPosts, type Page, type Post, type PostKind } from "@/lib/api/social";
import styles from "../profile.module.css";

const TABS: { value: PostKind; label: string; icon: IconName }[] = [
  { value: "personal", label: "Posts", icon: "grid" },
  { value: "business", label: "Business", icon: "store" },
];

function Tab({ ownerId, username, kind, initial, mine }: { ownerId: string; username: string; kind: PostKind; initial?: Page<Post>; mine: boolean }) {
  const me = useMe();
  const pages = usePages((cursor) => userPosts(ownerId, kind, cursor), initial);
  const business = kind === "business";
  return (
    <PostGrid
      pages={pages}
      empty={
        <Empty title={business ? "No business posts yet" : mine ? "Share your first post" : "No posts yet"}>
          {mine && business && (
            <>
              <p>Post offers and updates from the vendor portal.</p>
              <ButtonLink href="/vendor/posts" variant="secondary">
                Post as business
              </ButtonLink>
            </>
          )}
          {mine && !business && (
            <>
              <p>Your posts show up here and in everyone&apos;s feed.</p>
              <ButtonLink href="/feed" variant="secondary">
                Write a post
              </ButtonLink>
            </>
          )}
          {!mine && me && <p>When @{username} posts, it shows up here.</p>}
        </Empty>
      }
    />
  );
}

/** A profile's posts as a grid. Vendors also have a Business tab, filled from the vendor portal. */
export function ProfilePosts({ ownerId, username, vendor, initial }: { ownerId: string; username: string; vendor: boolean; initial: Page<Post> }) {
  const me = useMe();
  const [kind, setKind] = useState<PostKind>("personal");
  const tabs = vendor ? TABS : TABS.slice(0, 1);

  // Arrow keys move between tabs and pick one, as in any tab list; Tab moves on to the posts.
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const at = tabs.findIndex((t) => t.value === kind);
    const go = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: tabs.length - 1 }[event.key];
    if (go === undefined) return;
    event.preventDefault();
    const next = tabs[(go + tabs.length) % tabs.length]!;
    setKind(next.value);
    document.getElementById(`tab-${next.value}`)?.focus();
  };

  return (
    <section className={styles.posts} aria-label="Posts">
      <div className={styles.tabs} role="tablist" aria-label="Which posts" onKeyDown={onKey}>
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            id={`tab-${tab.value}`}
            aria-selected={kind === tab.value}
            aria-controls="profile-posts"
            tabIndex={kind === tab.value ? 0 : -1}
            className={styles.tab}
            onClick={() => setKind(tab.value)}
          >
            <Icon name={tab.icon} size={14} />
            <span className={styles.tabLabel}>{tab.label}</span>
          </button>
        ))}
      </div>
      <div id="profile-posts" role="tabpanel" aria-labelledby={`tab-${kind}`}>
        <Tab key={kind} ownerId={ownerId} username={username} kind={kind} initial={kind === "personal" ? initial : undefined} mine={me?.id === ownerId} />
      </div>
    </section>
  );
}
