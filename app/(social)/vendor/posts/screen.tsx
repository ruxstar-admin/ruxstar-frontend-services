"use client";

import { useState } from "react";
import { Composer } from "@/components/social/Composer";
import { PostGrid } from "@/components/social/PostGrid";
import { Empty } from "@/components/social/PostList";
import { useMe } from "@/components/social/session";
import { usePages } from "@/components/social/use-pages";
import { useLoad } from "@/components/vendor/use-load";
import { userPosts } from "@/lib/api/social";
import { myBusinesses } from "@/lib/api/vendor";
import styles from "@/components/vendor/vendor.module.css";

function BusinessPosts({ ownerId }: { ownerId: string }) {
  const pages = usePages((cursor) => userPosts(ownerId, "business", cursor));
  return (
    <PostGrid
      pages={pages}
      empty={
        <Empty title="No business posts yet">
          <p>Offers and updates you post show on your Business tab and in the feed.</p>
        </Empty>
      }
    />
  );
}

/** Post as one of your businesses, and every business post so far (your profile's Business tab). Same as the app. */
export function VendorPostsScreen() {
  const me = useMe();
  const businesses = useLoad(myBusinesses);
  const [picked, setPicked] = useState<string | null>(null);
  const [posted, setPosted] = useState(0);
  if (!me) return null;

  const list = businesses.data ?? [];
  const businessId = picked ?? list[0]?.id;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Posts</h1>
      {list.length > 1 && (
        <div className={styles.pickers} role="group" aria-label="Posting for">
          <span className={styles.label}>Posting for</span>
          {list.map((b) => (
            <button key={b.id} type="button" className={styles.chip} aria-pressed={b.id === businessId} onClick={() => setPicked(b.id)}>
              {b.name}
            </button>
          ))}
        </div>
      )}
      <Composer me={me} kind="business" businessId={businessId} onPosted={() => setPosted((n) => n + 1)} />
      <h2 className={styles.overline}>Your business posts</h2>
      <BusinessPosts key={posted} ownerId={me.id} />
    </div>
  );
}
