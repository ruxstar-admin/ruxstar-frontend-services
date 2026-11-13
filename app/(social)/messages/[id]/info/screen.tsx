"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChatAvatar } from "@/components/chat/ChatAvatar";
import { Avatar } from "@/components/profile/Avatar";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { Button, ButtonLink, Icon, Input, Skeleton, Switch, Tag, useToast } from "@/components/ui";
import { formError } from "@/lib/api/account";
import { getChat, GROUP_MAX, GROUP_TITLE_MAX, leaveChat, makeAdmin, muteChat, removePerson, renameGroup, type ChatDetail, type ChatPerson } from "@/lib/api/chats";
import styles from "@/components/chat/chat.module.css";
import menu from "@/components/social/PostCard.module.css";
import social from "@/components/social/social.module.css";

function PersonMenu({ person, onAdmin, onRemove }: { person: ChatPerson; onAdmin: () => Promise<void>; onRemove: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    await action();
    setBusy(false);
    setOpen(false);
  };

  return (
    <div className={menu.menuRoot} ref={root}>
      <button
        type="button"
        className={menu.iconButton}
        aria-label={`Options for ${person.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setConfirming(false);
          setOpen((o) => !o);
        }}
      >
        <Icon name="more" size={20} />
      </button>
      {open && (
        <div className={menu.menu} role="menu">
          {confirming ? (
            <div className={menu.confirm}>
              <p>Remove {person.name} from the group?</p>
              <div className={menu.confirmActions}>
                <Button variant="ghost" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
                <Button variant="danger" loading={busy} onClick={() => run(onRemove)}>
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Link href={`/u/${person.username}`} role="menuitem" className={menu.menuItem}>
                <Icon name="user" size={18} /> View profile
              </Link>
              {!person.admin && person.state === "active" && (
                <button type="button" role="menuitem" className={menu.menuItem} disabled={busy} onClick={() => run(onAdmin)}>
                  <Icon name="shield" size={18} /> Make admin
                </button>
              )}
              <button type="button" role="menuitem" className={menu.menuItem} data-danger onClick={() => setConfirming(true)}>
                <Icon name="close" size={18} /> Remove
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Mute, and for groups: its people, renaming and adding people (admins), and leaving. */
export function ChatInfoScreen({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const [chat, setChat] = useState<ChatDetail | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const [title, setTitle] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState<"ask" | "busy" | null>(null);

  useEffect(() => {
    let live = true;
    getChat(id).then(
      (detail) => live && setChat(detail),
      (err) => live && !onSignedOut(err) && setError(err),
    );
    return () => {
      live = false;
    };
  }, [id, attempt, onSignedOut]);

  const fail = (err: unknown) => {
    if (!onSignedOut(err)) toast(formError(err).message, "danger");
  };

  if (!chat) {
    return (
      <div className={social.column}>
        {error ? (
          <Empty title="Could not load this chat">
            <p>{formError(error).message}</p>
            <Button
              variant="secondary"
              onClick={() => {
                setError(null);
                setAttempt((n) => n + 1);
              }}
            >
              Try again
            </Button>
          </Empty>
        ) : (
          <>
            <Skeleton height={160} radius={18} />
            <Skeleton height={72} radius={18} />
          </>
        )}
      </div>
    );
  }

  const isGroup = chat.kind === "group";
  const name = title ?? chat.title;

  const setMuted = async (muted: boolean) => {
    const before = chat;
    setChat({ ...chat, muted });
    try {
      await muteChat(id, muted);
    } catch (err) {
      setChat(before);
      fail(err);
    }
  };

  const rename = async () => {
    setSaving(true);
    try {
      setChat(await renameGroup(id, name.trim()));
      setTitle(null);
      toast("Group renamed.", "success");
    } catch (err) {
      fail(err);
    } finally {
      setSaving(false);
    }
  };

  const leave = async () => {
    setLeaving("busy");
    try {
      await leaveChat(id);
      router.push("/messages");
    } catch (err) {
      fail(err);
      setLeaving(null);
    }
  };

  return (
    <div className={social.column}>
      <Link href={`/messages/${id}`} className={social.back}>
        <Icon name="arrow-left" size={18} /> Back to chat
      </Link>

      <div className={styles.infoHead}>
        <ChatAvatar chat={chat} size={88} />
        <h1 className={social.title}>{chat.title}</h1>
        <p className={social.subtitle}>{isGroup ? `${chat.members} of ${GROUP_MAX} people` : chat.peer ? `@${chat.peer.username}` : ""}</p>
        {!isGroup && chat.peer && (
          <ButtonLink href={`/u/${chat.peer.username}`} variant="secondary" icon={<Icon name="user" size={18} />}>
            View profile
          </ButtonLink>
        )}
      </div>

      <div className={styles.panel}>
        <Switch checked={chat.muted} onChange={setMuted} description="No unread count on the Messages tab for this chat.">
          Mute
        </Switch>
      </div>

      {isGroup && (
        <>
          {chat.admin && (
            <div className={styles.panel}>
              <form
                className={styles.renameRow}
                onSubmit={(e) => {
                  e.preventDefault();
                  rename();
                }}
              >
                <Input label="Group name" value={name} maxLength={GROUP_TITLE_MAX} onChange={(e) => setTitle(e.target.value)} />
                <Button type="submit" variant="secondary" loading={saving} disabled={!name.trim() || name.trim() === chat.title}>
                  Save
                </Button>
              </form>
            </div>
          )}

          <div className={social.headRow}>
            <p className={social.section}>People</p>
            {chat.admin && chat.members < GROUP_MAX && (
              <ButtonLink href={`/messages/new?add=${id}&size=${chat.members}`} variant="ghost" icon={<Icon name="plus" size={18} />}>
                Add people
              </ButtonLink>
            )}
          </div>
          <ul className={social.rows}>
            {chat.people.map((p) => (
              <li key={p.id} className={social.personRow}>
                <Link href={`/u/${p.username}`} className={social.row}>
                  <Avatar name={p.name} url={p.avatarUrl} size={44} />
                  <span className={social.rowText}>
                    <span className={social.rowTitle}>{p.me ? `${p.name} (you)` : p.name}</span>
                    <span className={social.rowSub}>@{p.username}</span>
                  </span>
                  <span className={styles.badges}>
                    {p.admin && <Tag tone="solid">Admin</Tag>}
                    {p.state === "request" && <Tag>Invited</Tag>}
                  </span>
                </Link>
                {chat.admin && !p.me && (
                  <PersonMenu
                    person={p}
                    onAdmin={async () => {
                      try {
                        setChat(await makeAdmin(id, p.id));
                      } catch (err) {
                        fail(err);
                      }
                    }}
                    onRemove={async () => {
                      try {
                        await removePerson(id, p.id);
                        setChat(await getChat(id));
                      } catch (err) {
                        fail(err);
                      }
                    }}
                  />
                )}
              </li>
            ))}
          </ul>

          <div className={styles.panel}>
            {leaving ? (
              <div className={menu.confirm}>
                <p>Leave {chat.title}? You won&apos;t get its messages unless someone adds you again.</p>
                <div className={menu.confirmActions}>
                  <Button variant="ghost" onClick={() => setLeaving(null)}>
                    Cancel
                  </Button>
                  <Button variant="danger" loading={leaving === "busy"} onClick={leave}>
                    Leave
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="danger" onClick={() => setLeaving("ask")}>
                Leave group
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
