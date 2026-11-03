"use client";

import { useEffect, useRef, useState } from "react";
import { ButtonLink, Segmented } from "@/components/ui";
import { Composer } from "@/components/social/Composer";
import { Empty, PostList } from "@/components/social/PostList";
import { useMe } from "@/components/social/session";
import { usePages } from "@/components/social/use-pages";
import { userPosts, type Page, type Post, type PostKind } from "@/lib/api/social";
import styles from "@/components/social/social.module.css";

const TABS = [
  { value: "personal", label: "Posts" },
  { value: "business", label: "Business" },
] as const;

function Tab({ ownerId, username, kind, initial, mine }: { ownerId: string; username: string; kind: PostKind; initial?: Page<Post>; mine: boolean }) {
  const me = useMe();
  const pages = usePages((cursor) => userPosts(ownerId, kind, cursor), initial);
  const { reload, setItems } = pages;

  // The server page is what anyone sees; once signed in, load it again so your likes and saves show.
  const personalised = useRef(false);
  useEffect(() => {
    if (!me || personalised.current) return;
    personalised.current = true;
    if (initial) reload();
  }, [me, initial, reload]);

  const business = kind === "business";
  return (
    <>
      {mine && me && !business && <Composer me={me} onPosted={(post) => setItems((list) => [post, ...list])} />}
      <PostList
        pages={pages}
        empty={
          <Empty title={business ? "No business posts yet" : mine ? "You have not posted yet" : "No posts yet"}>
            {mine && business && <p>Post offers and updates from the vendor portal in the Ruxstar app.</p>}
            {mine && !business && <p>Share something above. It shows up here and in everyone&apos;s feed.</p>}
            {!mine && !me && me !== undefined && (
              <ButtonLink href="/signup" variant="secondary">
                Join Ruxstar
              </ButtonLink>
            )}
            {!mine && me && <p>When @{username} posts, it shows up here.</p>}
          </Empty>
        }
      />
    </>
  );
}

/** A profile's posts. Vendors also have a Business tab, filled from the vendor portal. */
export function ProfilePosts({ ownerId, username, vendor, initial }: { ownerId: string; username: string; vendor: boolean; initial: Page<Post> }) {
  const me = useMe();
  const [kind, setKind] = useState<PostKind>("personal");
  const mine = me?.id === ownerId;

  return (
    <section className={styles.column} aria-label="Posts">
      {vendor && <Segmented label="Which posts" options={TABS} value={kind} onChange={setKind} />}
      <Tab key={kind} ownerId={ownerId} username={username} kind={kind} initial={kind === "personal" ? initial : undefined} mine={mine} />
    </section>
  );
}
