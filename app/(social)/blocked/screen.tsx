"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PeopleList } from "@/components/social/PeopleList";
import { useOnSignedOut } from "@/components/social/session";
import { usePages } from "@/components/social/use-pages";
import { Button, Icon, useToast } from "@/components/ui";
import { formError } from "@/lib/api/account";
import { blocked, setBlock, type Person } from "@/lib/api/social";
import styles from "@/components/social/social.module.css";

/** People you blocked, most recent first. Unblocking doesn't bring back the follows that ended. Signed in only. */
export function BlockedScreen() {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const pages = usePages(blocked);
  const { error, setItems } = pages;
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  const unblock = async (person: Person) => {
    setBusy(person.id);
    try {
      await setBlock(person.id, false);
      setItems((list) => list.filter((p) => p.id !== person.id));
      toast(`Unblocked @${person.username}.`, "success");
    } catch (err) {
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={styles.column}>
      <Link href="/account#blocked" className={styles.back}>
        <Icon name="arrow-left" size={18} /> Account
      </Link>
      <h1 className={styles.title}>Blocked accounts</h1>
      <PeopleList
        pages={pages}
        empty={{ title: "No blocked accounts", text: "People you block can't see your posts, comment, follow or message you." }}
        action={(p) => (
          <Button variant="secondary" loading={busy === p.id} onClick={() => unblock(p)}>
            Unblock
          </Button>
        )}
      />
    </div>
  );
}
