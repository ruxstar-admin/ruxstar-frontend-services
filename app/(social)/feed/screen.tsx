"use client";

import { useEffect, useState } from "react";
import { Composer } from "@/components/social/Composer";
import { Empty, PostList } from "@/components/social/PostList";
import { useMe, useOnSignedOut } from "@/components/social/session";
import { usePages } from "@/components/social/use-pages";
import { ButtonLink, Segmented } from "@/components/ui";
import { feed, type FeedTab, type Post } from "@/lib/api/social";
import styles from "@/components/social/social.module.css";

const TABS: { value: FeedTab; label: string }[] = [
  { value: "for_you", label: "For you" },
  { value: "following", label: "Following" },
];

function Tab({ tab, posted }: { tab: FeedTab; posted: Post | null }) {
  const onSignedOut = useOnSignedOut();
  const pages = usePages((cursor) => feed(tab, cursor));
  const { error, setItems } = pages;

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  useEffect(() => {
    if (posted) setItems((list) => (list.some((p) => p.id === posted.id) ? list : [posted, ...list]));
  }, [posted, setItems]);

  return (
    <PostList
      pages={pages}
      empty={
        tab === "following" ? (
          <Empty title="No one to show yet">
            <p>Follow people and their posts show up here, newest first.</p>
            <ButtonLink href="/search" variant="secondary">
              Find people
            </ButtonLink>
          </Empty>
        ) : (
          <Empty title="Nothing here yet">
            <p>Be the first to post something. It shows up here for everyone on Ruxstar.</p>
          </Empty>
        )
      }
    />
  );
}

/** For you ranks the week's posts by likes and comments; Following is people you follow. A composer sits on top. Signed in only. */
export function FeedScreen() {
  const me = useMe();
  const [tab, setTab] = useState<FeedTab>("for_you");
  const [posted, setPosted] = useState<Post | null>(null);

  return (
    <div className={styles.column}>
      <h1 className="sr-only">Feed</h1>
      {me && <Composer me={me} onPosted={setPosted} />}
      <Segmented label="Feed" options={TABS} value={tab} onChange={setTab} />
      <Tab key={tab} tab={tab} posted={posted} />
    </div>
  );
}
