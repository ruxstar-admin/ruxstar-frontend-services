"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/profile/Avatar";
import { Button, Icon, useToast } from "@/components/ui";
import { PostCard } from "@/components/social/PostCard";
import { PostText } from "@/components/social/PostText";
import { useBack } from "@/components/social/Shell";
import { useMe, useOnSignedOut } from "@/components/social/session";
import { usePages } from "@/components/social/use-pages";
import { formError } from "@/lib/api/account";
import { addComment, COMMENT_TEXT_MAX, comments as loadComments, deleteComment, editComment, getPost, type Comment, type Post } from "@/lib/api/social";
import { ago, exact } from "@/lib/time";
import styles from "@/components/social/social.module.css";

/** The counter shows once a comment gets this close to the limit. */
const COUNTER_FROM = COMMENT_TEXT_MAX - 60;

function Counter({ length }: { length: number }) {
  if (length < COUNTER_FROM) return null;
  const left = COMMENT_TEXT_MAX - length;
  return (
    <span className={styles.count} data-near={left <= 10 || undefined} aria-live="polite">
      {`${left} left`}
    </span>
  );
}

interface CommentItemProps {
  comment: Comment;
  /** Yours, or on your post. */
  canDelete: boolean;
  onSaved: (comment: Comment) => void;
  onDelete: (comment: Comment) => void;
}

/** One comment. Yours can be edited in place; yours, or any on your post, deleted after a confirm. */
function CommentItem({ comment, canDelete, onSaved, onDelete }: CommentItemProps) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const [mode, setMode] = useState<"view" | "edit" | "delete">("view");
  const [text, setText] = useState(comment.text);
  const [saving, setSaving] = useState(false);

  const cancel = () => {
    setText(comment.text);
    setMode("view");
  };
  const save = async () => {
    const body = text.trim();
    if (!body || saving) return;
    if (body === comment.text) return cancel();
    setSaving(true);
    try {
      onSaved(await editComment(comment.id, body));
      setMode("view");
    } catch (err) {
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.comment}>
      <Link href={`/u/${comment.author.username}`} tabIndex={-1} aria-hidden>
        <Avatar name={comment.author.name} url={comment.author.avatarUrl} size={36} />
      </Link>
      <div className={styles.commentBody}>
        <p className={styles.commentHead}>
          <Link href={`/u/${comment.author.username}`}>{comment.author.name}</Link>
          <time dateTime={comment.createdAt} title={exact(comment.createdAt)}>
            {ago(comment.createdAt)}
          </time>
          {comment.editedAt && <span>Edited</span>}
        </p>
        {mode === "edit" ? (
          <form
            className={styles.commentEditForm}
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <textarea
              className={styles.commentInput}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") cancel();
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  save();
                }
              }}
              maxLength={COMMENT_TEXT_MAX}
              aria-label="Edit your comment"
              rows={2}
              autoFocus
            />
            <div className={styles.commentEditActions}>
              <Counter length={text.length} />
              <Button variant="ghost" onClick={cancel}>
                Cancel
              </Button>
              <Button type="submit" loading={saving} disabled={!text.trim()}>
                Save
              </Button>
            </div>
          </form>
        ) : (
          <PostText text={comment.text} className={styles.commentText} />
        )}
        {mode === "delete" && (
          <div className={styles.commentConfirm}>
            <p>Delete this comment for everyone?</p>
            <Button variant="ghost" onClick={() => setMode("view")}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => onDelete(comment)}>
              Delete
            </Button>
          </div>
        )}
      </div>
      {mode === "view" && (comment.mine || canDelete) && (
        <span className={styles.commentTools}>
          {comment.mine && (
            <button type="button" className={`${styles.commentDelete} ${styles.commentEdit}`} onClick={() => setMode("edit")} aria-label="Edit comment">
              <Icon name="edit" size={16} />
            </button>
          )}
          {canDelete && (
            <button type="button" className={styles.commentDelete} onClick={() => setMode("delete")} aria-label="Delete comment">
              <Icon name="trash" size={16} />
            </button>
          )}
        </span>
      )}
    </div>
  );
}

/**
 * A post with its comments. The server renders it as anyone sees it; once we know who you are,
 * it is fetched again so your like, save and menu are right. Comments go with your cookie, so
 * theirs-or-yours is right from the start.
 */
export function PostThread({ initial }: { initial: Post }) {
  const me = useMe();
  const router = useRouter();
  const back = useBack();
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const [post, setPost] = useState(initial);
  const { items, setItems, hasMore, loadingMore, more, loading } = usePages((cursor) => loadComments(initial.id, cursor));
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const section = useRef<HTMLElement>(null);

  const signedIn = !!me;
  useEffect(() => {
    if (signedIn) getPost(initial.id).then(setPost, () => undefined);
  }, [signedIn, initial.id]);

  useEffect(() => {
    if (window.location.hash === "#comments") section.current?.scrollIntoView({ block: "start" });
  }, []);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const comment = await addComment(post.id, text);
      setItems((list) => [comment, ...list]);
      setPost((p) => ({ ...p, counts: { ...p.counts, comments: p.counts.comments + 1 } }));
      setDraft("");
    } catch (err) {
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setSending(false);
    }
  };

  const remove = async (comment: Comment) => {
    setItems((list) => list.filter((c) => c.id !== comment.id));
    setPost((p) => ({ ...p, counts: { ...p.counts, comments: Math.max(0, p.counts.comments - 1) } }));
    try {
      await deleteComment(comment.id);
    } catch (err) {
      setItems((list) => [comment, ...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setPost((p) => ({ ...p, counts: { ...p.counts, comments: p.counts.comments + 1 } }));
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    }
  };

  return (
    <div className={styles.column}>
      <button type="button" className={styles.back} onClick={back}>
        <Icon name="arrow-left" size={18} /> Back
      </button>
      <PostCard
        post={post}
        onChange={setPost}
        onRemove={() => router.replace("/feed")}
        eager
        onComment={() => (me ? input.current?.focus() : section.current?.scrollIntoView({ behavior: "smooth" }))}
      />

      <section id="comments" ref={section} className={styles.comments} aria-label="Comments">
        {me ? (
          <form
            className={styles.commentForm}
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <Avatar name={me.name} url={me.avatarUrl} size={36} />
            <textarea
              ref={input}
              className={styles.commentInput}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              maxLength={COMMENT_TEXT_MAX}
              placeholder="Add a comment"
              aria-label="Add a comment"
              rows={1}
            />
            <Counter length={draft.length} />
            <Button type="submit" loading={sending} disabled={!draft.trim()}>
              Post
            </Button>
          </form>
        ) : (
          me === null && (
            <p className={styles.signInPrompt}>
              <Link href={`/signin?next=/p/${post.id}`}>Sign in</Link> to like, save and comment.
            </p>
          )
        )}

        {!loading && items.length === 0 && <p className={styles.subtitle}>No comments yet. Start the conversation.</p>}
        {items.map((c) => (
          <CommentItem
            key={c.id}
            comment={c}
            canDelete={!!me && (c.mine || post.mine)}
            onSaved={(saved) => setItems((list) => list.map((x) => (x.id === saved.id ? saved : x)))}
            onDelete={remove}
          />
        ))}
        {hasMore && (
          <Button variant="ghost" onClick={more} loading={loadingMore}>
            Show more comments
          </Button>
        )}
      </section>
    </div>
  );
}
