"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/profile/Avatar";
import { Button, Icon, useToast } from "@/components/ui";
import { PostCard } from "@/components/social/PostCard";
import { useBack } from "@/components/social/Shell";
import { useMe, useOnSignedOut } from "@/components/social/session";
import { usePages } from "@/components/social/use-pages";
import { formError } from "@/lib/api/account";
import { addComment, COMMENT_TEXT_MAX, comments as loadComments, deleteComment, getPost, type Comment, type Post } from "@/lib/api/social";
import { ago, exact } from "@/lib/time";
import styles from "@/components/social/social.module.css";

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
            <Button type="submit" loading={sending} disabled={!draft.trim()}>
              Reply
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
          <div key={c.id} className={styles.comment}>
            <Link href={`/u/${c.author.username}`} tabIndex={-1} aria-hidden>
              <Avatar name={c.author.name} url={c.author.avatarUrl} size={36} />
            </Link>
            <div className={styles.commentBody}>
              <p className={styles.commentHead}>
                <Link href={`/u/${c.author.username}`}>{c.author.name}</Link>
                <time dateTime={c.createdAt} title={exact(c.createdAt)}>
                  {ago(c.createdAt)}
                </time>
              </p>
              <p className={styles.commentText}>{c.text}</p>
            </div>
            {me && (c.mine || post.mine) && (
              <button type="button" className={styles.commentDelete} onClick={() => remove(c)} aria-label="Delete comment">
                <Icon name="trash" size={16} />
              </button>
            )}
          </div>
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
