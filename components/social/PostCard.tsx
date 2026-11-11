"use client";

import Link from "next/link";
import { memo, useEffect, useRef, useState, type KeyboardEvent as KeyEvent } from "react";
import { Avatar } from "@/components/profile/Avatar";
import { Button, Icon, Tag, useToast } from "@/components/ui";
import { formError } from "@/lib/api/account";
import { deletePost, editPost, photoSrcSet, POST_TEXT_MAX, REPORT_REASONS, reportPost, setLike, setSave, type Post } from "@/lib/api/social";
import { ago, compact, exact } from "@/lib/time";
import { useMe, useOnSignedOut, useSignInFirst } from "./session";
import styles from "./PostCard.module.css";

interface PostCardProps {
  post: Post;
  onChange: (post: Post) => void;
  onRemove: (id: string) => void;
  /** Above the fold: load its photos straight away. */
  eager?: boolean;
  /** On the post's own page the comment button scrolls instead of linking. */
  onComment?: () => void;
}

/** The feed column is at most 640 px wide; on phones it is the screen less its margins. */
const ONE_PHOTO = "(max-width: 640px) 100vw, 640px";
const TWO_UP = "(max-width: 640px) 50vw, 320px";

function Photos({ post, eager }: { post: Post; eager?: boolean }) {
  const { media } = post;
  if (media.length === 0) return null;
  const loading = eager ? "eager" : "lazy";
  if (media.length === 1) {
    const [photo] = media;
    return (
      <Link href={`/p/${post.id}`} className={styles.single} style={{ aspectRatio: `${photo!.width} / ${photo!.height}` }} tabIndex={-1}>
        <img
          src={photo!.url}
          srcSet={photoSrcSet(photo!)}
          sizes={ONE_PHOTO}
          width={photo!.width}
          height={photo!.height}
          alt=""
          loading={loading}
          decoding="async"
          fetchPriority={eager ? "high" : "auto"}
        />
      </Link>
    );
  }
  return (
    <Link href={`/p/${post.id}`} className={styles.grid} data-count={media.length} tabIndex={-1}>
      {media.map((photo) => (
        <img
          key={photo.url}
          src={photo.url}
          srcSet={photoSrcSet(photo)}
          sizes={TWO_UP}
          width={photo.width}
          height={photo.height}
          alt=""
          loading={loading}
          decoding="async"
        />
      ))}
    </Link>
  );
}

type MenuView = "main" | "delete" | "report";

function Menu({ post, onEdit, onRemove }: { post: Post; onEdit: () => void; onRemove: (id: string) => void }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
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

  // Opening, or moving to the delete or report step, puts focus on its first choice.
  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>("button:not(:disabled)")?.focus();
  }, [open, view]);

  const onMenuKey = (event: KeyEvent) => {
    if (event.key === "Tab") return setOpen(false);
    const items = [...(list.current?.querySelectorAll<HTMLElement>("button:not(:disabled)") ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    const go = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: items.length - 1 }[event.key];
    if (go === undefined || items.length === 0) return;
    event.preventDefault();
    items[(go + items.length) % items.length]?.focus();
  };

  const run = async (action: () => Promise<unknown>, done: () => void) => {
    setBusy(true);
    try {
      await action();
      done();
      setOpen(false);
    } catch (err) {
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.menuRoot} ref={root}>
      <button
        ref={trigger}
        type="button"
        className={styles.iconButton}
        aria-label="Post options"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `menu-${post.id}` : undefined}
        onClick={() => {
          setView("main");
          setOpen((o) => !o);
        }}
      >
        <Icon name="more" size={20} />
      </button>
      {open && (
        <div ref={list} id={`menu-${post.id}`} className={styles.menu} role="menu" aria-label="Post options" onKeyDown={onMenuKey}>
          {view === "main" &&
            (post.mine ? (
              <>
                <button type="button" role="menuitem" className={styles.menuItem} onClick={() => (setOpen(false), onEdit())}>
                  <Icon name="edit" size={18} /> Edit
                </button>
                <button type="button" role="menuitem" className={styles.menuItem} data-danger onClick={() => setView("delete")}>
                  <Icon name="trash" size={18} /> Delete
                </button>
              </>
            ) : (
              <button type="button" role="menuitem" className={styles.menuItem} onClick={() => setView("report")}>
                <Icon name="flag" size={18} /> Report
              </button>
            ))}
          {view === "delete" && (
            <div className={styles.confirm}>
              <p>Delete this post for everyone?</p>
              <div className={styles.confirmActions}>
                <Button variant="ghost" onClick={() => setView("main")}>
                  Cancel
                </Button>
                <Button variant="danger" loading={busy} onClick={() => run(() => deletePost(post.id), () => (onRemove(post.id), toast("Post deleted.", "success")))}>
                  Delete
                </Button>
              </div>
            </div>
          )}
          {view === "report" && (
            <>
              <p className={styles.menuHead}>Why are you reporting this?</p>
              {REPORT_REASONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  role="menuitem"
                  className={styles.menuItem}
                  disabled={busy}
                  onClick={() => run(() => reportPost(post.id, r.value), () => toast("Thanks. We will take a look.", "success"))}
                >
                  {r.label}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Editor({ post, onDone }: { post: Post; onDone: (post?: Post) => void }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const [text, setText] = useState(post.text);
  const [saving, setSaving] = useState(false);
  const empty = !text.trim() && post.media.length === 0;

  const save = async () => {
    setSaving(true);
    try {
      onDone(await editPost(post.id, text.trim()));
    } catch (err) {
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
      setSaving(false);
    }
  };

  return (
    <div className={styles.editor}>
      <textarea
        className={styles.editText}
        value={text}
        maxLength={POST_TEXT_MAX}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && !empty && save()}
        aria-label="Post text"
        autoFocus
        rows={3}
      />
      <div className={styles.editActions}>
        <span className={styles.count}>{`${text.length}/${POST_TEXT_MAX}`}</span>
        <Button variant="ghost" onClick={() => onDone()}>
          Cancel
        </Button>
        <Button onClick={save} loading={saving} disabled={empty || text.trim() === post.text}>
          Save
        </Button>
      </div>
    </div>
  );
}

/** One post: author, text, photos, and like, comment, share and save. Likes and saves show at once and undo on failure. */
export const PostCard = memo(function PostCard({ post, onChange, onRemove, eager, onComment }: PostCardProps) {
  const me = useMe();
  const toast = useToast();
  const signInFirst = useSignInFirst();
  const onSignedOut = useOnSignedOut();
  const [editing, setEditing] = useState(false);
  const [popping, setPopping] = useState(false);
  const { author } = post;

  const toggle = async (kind: "like" | "save") => {
    if (!me) return signInFirst();
    const before = post;
    if (kind === "like") {
      const on = !post.likedByMe;
      if (on) setPopping(true);
      onChange({ ...post, likedByMe: on, counts: { ...post.counts, likes: post.counts.likes + (on ? 1 : -1) } });
      try {
        const state = await setLike(post.id, on);
        onChange({ ...before, likedByMe: state.likedByMe, counts: { ...before.counts, likes: state.likes } });
      } catch (err) {
        onChange(before);
        if (!onSignedOut(err)) toast(formError(err).message, "danger");
      }
    } else {
      const on = !post.savedByMe;
      onChange({ ...post, savedByMe: on });
      try {
        await setSave(post.id, on);
        toast(on ? "Saved. Find it under Saved." : "Removed from Saved.");
      } catch (err) {
        onChange(before);
        if (!onSignedOut(err)) toast(formError(err).message, "danger");
      }
    }
  };

  const share = async () => {
    const url = `${window.location.origin}/p/${post.id}`;
    if (navigator.share) {
      await navigator.share({ title: `${author.name} on Ruxstar`, url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(url).then(
      () => toast("Link copied."),
      () => toast(url),
    );
  };

  return (
    <article className={styles.card} aria-labelledby={`post-${post.id}`}>
      <header className={styles.head}>
        <Link href={`/u/${author.username}`} className={styles.author}>
          <Avatar name={author.name} url={author.avatarUrl} size={44} />
          <span className={styles.who}>
            <span className={styles.nameRow}>
              <span id={`post-${post.id}`} className={styles.name}>
                {author.name}
              </span>
              {post.kind === "business" ? <Tag tone="solid">Store</Tag> : author.vendor ? <Tag>Vendor</Tag> : null}
            </span>
            <span className={styles.meta}>
              @{author.username} ·{" "}
              <time dateTime={post.createdAt} title={exact(post.createdAt)}>
                {ago(post.createdAt)}
              </time>
              {post.editedAt && " · Edited"}
            </span>
          </span>
        </Link>
        {me && <Menu post={post} onEdit={() => setEditing(true)} onRemove={onRemove} />}
      </header>

      {editing ? (
        <Editor
          post={post}
          onDone={(updated) => {
            setEditing(false);
            if (updated) onChange(updated);
          }}
        />
      ) : (
        post.text && <p className={styles.text}>{post.text}</p>
      )}

      <Photos post={post} eager={eager} />

      <footer className={styles.actions}>
        <button
          type="button"
          className={styles.action}
          data-on={post.likedByMe || undefined}
          data-tone="like"
          aria-pressed={post.likedByMe}
          aria-label={post.likedByMe ? "Unlike" : "Like"}
          onClick={() => toggle("like")}
        >
          <span className={styles.heart} data-pop={popping || undefined} onAnimationEnd={() => setPopping(false)}>
            <Icon name="heart" filled={post.likedByMe} size={22} />
          </span>
          <span className={styles.num}>{compact(post.counts.likes)}</span>
        </button>
        {onComment ? (
          <button type="button" className={styles.action} aria-label="Comments" onClick={onComment}>
            <Icon name="comment" size={22} />
            <span className={styles.num}>{compact(post.counts.comments)}</span>
          </button>
        ) : (
          <Link href={`/p/${post.id}#comments`} className={styles.action} aria-label={`${post.counts.comments} comments`}>
            <Icon name="comment" size={22} />
            <span className={styles.num}>{compact(post.counts.comments)}</span>
          </Link>
        )}
        <button type="button" className={styles.action} aria-label="Share" onClick={share}>
          <Icon name="share" size={22} />
        </button>
        <span className={styles.spacer} />
        <button
          type="button"
          className={styles.action}
          data-on={post.savedByMe || undefined}
          data-tone="save"
          aria-pressed={post.savedByMe}
          aria-label={post.savedByMe ? "Remove from saved" : "Save"}
          onClick={() => toggle("save")}
        >
          <Icon name="bookmark" filled={post.savedByMe} size={22} />
        </button>
      </footer>
    </article>
  );
});

export function PostSkeleton() {
  return (
    <div className={styles.card} aria-hidden>
      <div className={styles.head}>
        <div className={styles.author}>
          <span className={styles.skelCircle} />
          <span className={styles.who}>
            <span className={styles.skelLine} style={{ width: 140 }} />
            <span className={styles.skelLine} style={{ width: 90 }} />
          </span>
        </div>
      </div>
      <span className={styles.skelLine} style={{ width: "92%" }} />
      <span className={styles.skelBlock} />
    </div>
  );
}
