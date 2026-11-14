"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Button, ButtonLink, Icon, useToast } from "@/components/ui";
import { useMe, useOnSignedOut } from "@/components/social/session";
import { formError, type User } from "@/lib/api/account";
import { ApiError } from "@/lib/api/client";
import { relation as loadRelation, reportUser, setBlock, setFollow, USER_REPORT_REASONS, type Relation } from "@/lib/api/social";
import { compact } from "@/lib/time";
import menu from "@/components/social/PostCard.module.css";
import styles from "../profile.module.css";

interface Shared {
  ownerId: string;
  username: string;
  name: string;
  /** Yours to see: null while loading, signed out, or on your own profile. */
  relation: Relation | null;
  setRelation: (relation: Relation) => void;
  /** They blocked you. */
  unavailable: boolean;
  counts: { followers: number; following: number };
}

const RelationContext = createContext<Shared | null>(null);
const useRelation = () => useContext(RelationContext)!;

/** Wraps a profile, so its counts, buttons and posts agree on whether you follow or blocked them. */
export function ProfileRelation({
  ownerId,
  username,
  name,
  counts,
  children,
}: {
  ownerId: string;
  username: string;
  name: string;
  counts: { followers: number; following: number };
  children: ReactNode;
}) {
  const me = useMe();
  const [relation, setRelation] = useState<Relation | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const signedInOther = !!me && me.id !== ownerId;

  useEffect(() => {
    if (!signedInOther) return;
    let live = true;
    loadRelation(ownerId)
      .then((r) => live && setRelation(r))
      .catch((err) => live && err instanceof ApiError && err.code === "NOT_FOUND" && setUnavailable(true));
    return () => {
      live = false;
    };
  }, [signedInOther, ownerId]);

  const value: Shared = {
    ownerId,
    username,
    name,
    relation: signedInOther ? relation : null,
    setRelation,
    unavailable: signedInOther && unavailable,
    counts: (signedInOther && relation?.counts) || counts,
  };
  return <RelationContext.Provider value={value}>{children}</RelationContext.Provider>;
}

/** Posts, followers and following; the last two open their lists. */
export function ProfileStats({ posts }: { posts: number }) {
  const { username, counts, relation, unavailable } = useRelation();
  const hidden = unavailable || !!relation?.blockedByMe;
  const item = (n: number, one: string, many: string) => (
    <>
      <strong>{compact(n)}</strong> {n === 1 ? one : many}
    </>
  );
  return (
    <ul className={styles.stats}>
      <li>{item(posts, "post", "posts")}</li>
      <li>{hidden ? item(counts.followers, "follower", "followers") : <Link href={`/u/${username}/followers`}>{item(counts.followers, "follower", "followers")}</Link>}</li>
      <li>{hidden ? item(counts.following, "following", "following") : <Link href={`/u/${username}/following`}>{item(counts.following, "following", "following")}</Link>}</li>
    </ul>
  );
}

/** Hides someone's posts once you blocked them, or they blocked you. */
export function UnlessBlocked({ children }: { children: ReactNode }) {
  const { relation, unavailable, username } = useRelation();
  if (unavailable) return <p className={styles.blockedNote}>This account isn&apos;t available to you.</p>;
  if (relation?.blockedByMe) {
    return <p className={styles.blockedNote}>You blocked @{username}. Neither of you can see the other&apos;s posts, comment, follow or message.</p>;
  }
  return children;
}

type MenuView = "main" | "block" | "report" | "reported";

function MoreMenu() {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const { ownerId, name, username, relation, setRelation } = useRelation();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<MenuView>("main");
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent) {
        if (event.key !== "Escape") return;
        setOpen(false);
        trigger.current?.focus();
      } else if (!root.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>("button:not(:disabled)")?.focus();
  }, [open, view]);

  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await action();
      toast(done, "success");
      setOpen(false);
    } catch (err) {
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setBusy(false);
    }
  };

  const report = async (reason: (typeof USER_REPORT_REASONS)[number]["value"]) => {
    setBusy(true);
    try {
      await reportUser(ownerId, reason);
      setView("reported");
    } catch (err) {
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setBusy(false);
    }
  };

  const blocked = !!relation?.blockedByMe;

  return (
    <div className={menu.menuRoot} ref={root}>
      <button
        ref={trigger}
        type="button"
        className={menu.iconButton}
        aria-label="More options"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setView("main");
          setOpen((o) => !o);
        }}
      >
        <Icon name="more" size={20} />
      </button>
      {open && (
        <div ref={list} className={menu.menu} role="menu" aria-label="More options">
          {view === "main" && (
            <>
              {blocked ? (
                <button type="button" role="menuitem" className={menu.menuItem} disabled={busy} onClick={() => run(async () => setRelation(await setBlock(ownerId, false)), `Unblocked @${username}.`)}>
                  <Icon name="close" size={18} /> Unblock
                </button>
              ) : (
                <button type="button" role="menuitem" className={menu.menuItem} data-danger onClick={() => setView("block")}>
                  <Icon name="close" size={18} /> Block
                </button>
              )}
              <button type="button" role="menuitem" className={menu.menuItem} onClick={() => setView("report")}>
                <Icon name="flag" size={18} /> Report
              </button>
            </>
          )}
          {view === "block" && (
            <div className={menu.confirm}>
              <p>
                Block {name}? You won&apos;t see each other&apos;s posts, comments or profile, and you&apos;ll stop following each other. They won&apos;t be told.
              </p>
              <div className={menu.confirmActions}>
                <Button variant="ghost" onClick={() => setView("main")}>
                  Cancel
                </Button>
                <Button variant="danger" loading={busy} onClick={() => run(async () => setRelation(await setBlock(ownerId, true)), `Blocked @${username}.`)}>
                  Block
                </Button>
              </div>
            </div>
          )}
          {view === "report" && (
            <>
              <p className={menu.menuHead}>Why are you reporting {name}?</p>
              {USER_REPORT_REASONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  role="menuitem"
                  className={menu.menuItem}
                  disabled={busy}
                  onClick={() => void report(r.value)}
                >
                  {r.label}
                </button>
              ))}
            </>
          )}
          {view === "reported" && (
            <div className={menu.confirm}>
              <p>
                <strong>Thanks for telling us</strong>
                <br />
                The Ruxstar team will take a look.
              </p>
              <div className={menu.confirmActions}>
                {!blocked && (
                  <Button variant="secondary" loading={busy} onClick={() => run(async () => setRelation(await setBlock(ownerId, true)), `Blocked @${username}.`)}>
                    {`Also block ${name}`}
                  </Button>
                )}
                <Button disabled={busy} onClick={() => setOpen(false)}>
                  Done
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const STEPS = [
  { key: "photo", label: "Add a photo", done: (me: User) => !!me.avatarUrl },
  { key: "bio", label: "Add a bio", done: (me: User) => !!me.bio?.trim() },
  { key: "city", label: "Add your city", done: (me: User) => !!me.city?.trim() },
] as const;

/** On your own profile: what is still missing, one click each. Nothing once all three are done. Same as the app. */
export function ProfileChecklist() {
  const me = useMe();
  const { ownerId } = useRelation();
  if (!me || me.id !== ownerId) return null;
  const missing = STEPS.filter((step) => !step.done(me));
  if (missing.length === 0) return null;
  const done = STEPS.length - missing.length;

  return (
    <section className={styles.checklist} aria-label="Finish your profile">
      <div className={styles.checklistHead}>
        <strong>Finish your profile</strong>
        <span className={styles.checklistCount}>{`${done} of ${STEPS.length}`}</span>
      </div>
      <div className={styles.track} role="progressbar" aria-label="Profile completion" aria-valuemin={0} aria-valuemax={STEPS.length} aria-valuenow={done}>
        <span className={styles.fill} style={{ width: `${(done / STEPS.length) * 100}%` }} />
      </div>
      <p className={styles.checklistText}>People trust a profile with a face, a line about you and a city.</p>
      <div className={styles.checklistSteps}>
        {missing.map((step) => (
          <Link key={step.key} href="/account#profile" className={styles.step}>
            <Icon name="plus" size={16} />
            {step.label}
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Beside the username: Edit profile and Delivery partner on yours, Follow and More on someone else's, Join for signed-out visitors. */
export function ProfileActions({ delivery = false }: { delivery?: boolean }) {
  const me = useMe();
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const router = useRouter();
  const { ownerId, name, username, relation, setRelation, unavailable } = useRelation();
  const [busy, setBusy] = useState(false);

  if (me === undefined) return null;
  if (me?.id === ownerId) {
    const share = async () => {
      const url = `${window.location.origin}/u/${username}`;
      if (navigator.share) {
        await navigator.share({ title: `${name} on Ruxstar`, url }).catch(() => undefined);
        return;
      }
      await navigator.clipboard.writeText(url).then(
        () => toast("Link copied."),
        () => toast(url),
      );
    };
    // Approval happens on the server, so the profile's badge counts before the session's roles catch up.
    const partner = me.roles.delivery || delivery;
    return (
      <div className={styles.actions}>
        <ButtonLink href="/account" variant="secondary">
          Edit profile
        </ButtonLink>
        <ButtonLink
          href="/verify/delivery"
          variant={partner ? "primary" : "secondary"}
          className={styles.iconAction}
          aria-label={partner ? "Delivery partner: use the Ruxstar Delivery app" : "Become a delivery partner"}
          title={partner ? "Delivery partner: use the Ruxstar Delivery app" : "Become a delivery partner"}
        >
          <Icon name="bicycle" size={22} />
        </ButtonLink>
        <Button variant="secondary" icon={<Icon name="share" size={18} />} onClick={() => void share()}>
          Share profile
        </Button>
      </div>
    );
  }
  if (!me) return <ButtonLink href="/signup">Join Ruxstar</ButtonLink>;
  if (unavailable) return null;

  const toggle = async () => {
    if (!relation) return;
    const on = !relation.following;
    const before = relation;
    setRelation({ ...relation, following: on, counts: { ...relation.counts, followers: Math.max(0, relation.counts.followers + (on ? 1 : -1)) } });
    setBusy(true);
    try {
      setRelation(await setFollow(ownerId, on));
    } catch (err) {
      setRelation(before);
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setBusy(false);
    }
  };

  const message = () => router.push(`/messages/with/${ownerId}`);

  return (
    <div className={styles.actions}>
      {relation?.blockedByMe ? null : (
        <>
          <Button variant={relation?.following ? "secondary" : "primary"} onClick={toggle} disabled={!relation || busy}>
            {relation?.following ? "Following" : relation?.followsMe ? "Follow back" : "Follow"}
          </Button>
          <Button variant="secondary" onClick={message} disabled={!relation}>
            Message
          </Button>
        </>
      )}
      <MoreMenu />
    </div>
  );
}
