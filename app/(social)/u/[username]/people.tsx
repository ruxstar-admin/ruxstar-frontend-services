"use client";

import Link from "next/link";
import { useState } from "react";
import { PeopleList } from "@/components/social/PeopleList";
import { useMe, useOnSignedOut, useSignInFirst } from "@/components/social/session";
import { usePages } from "@/components/social/use-pages";
import { Button, Icon, Segmented, useToast } from "@/components/ui";
import { formError } from "@/lib/api/account";
import { followers, following, setFollow, type Person } from "@/lib/api/social";
import styles from "@/components/social/social.module.css";

type Side = "followers" | "following";

const TABS: { value: Side; label: string }[] = [
  { value: "followers", label: "Followers" },
  { value: "following", label: "Following" },
];

function List({ username, side }: { username: string; side: Side }) {
  const me = useMe();
  const toast = useToast();
  const signInFirst = useSignInFirst();
  const onSignedOut = useOnSignedOut();
  const pages = usePages((cursor) => (side === "followers" ? followers(username, cursor) : following(username, cursor)));
  const [busy, setBusy] = useState<string | null>(null);

  const toggle = async (person: Person) => {
    if (!me) return signInFirst();
    const on = !person.followedByMe;
    const flip = (value: boolean) => pages.setItems((list) => list.map((p) => (p.id === person.id ? { ...p, followedByMe: value } : p)));
    setBusy(person.id);
    flip(on);
    try {
      await setFollow(person.id, on);
    } catch (err) {
      flip(!on);
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setBusy(null);
    }
  };

  return (
    <PeopleList
      pages={pages}
      empty={{ title: side === "followers" ? "No followers yet" : "Not following anyone yet" }}
      action={(p) =>
        p.me ? null : (
          <Button variant={p.followedByMe ? "secondary" : "primary"} disabled={busy === p.id} onClick={() => toggle(p)}>
            {p.followedByMe ? "Following" : "Follow"}
          </Button>
        )
      }
    />
  );
}

/** Who someone follows and who follows them. Anyone can look; signed in, each person has Follow. */
export function PeopleScreen({ username, side: initial }: { username: string; side: Side }) {
  const [side, setSide] = useState<Side>(initial);
  return (
    <div className={styles.column}>
      <Link href={`/u/${username}`} className={styles.back}>
        <Icon name="arrow-left" size={18} /> @{username}
      </Link>
      <h1 className="sr-only">{side === "followers" ? "Followers" : "Following"}</h1>
      <Segmented
        label="Show"
        options={TABS}
        value={side}
        onChange={(next) => {
          setSide(next);
          window.history.replaceState(null, "", `/u/${username}/${next}`);
        }}
      />
      <List key={side} username={username} side={side} />
    </div>
  );
}
