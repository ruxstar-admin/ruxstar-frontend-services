"use client";

import { useEffect, useRef, useState, type ClipboardEvent } from "react";
import { Avatar } from "@/components/profile/Avatar";
import { Button, Icon, useToast } from "@/components/ui";
import { formError, type User } from "@/lib/api/account";
import { createPost, POST_PHOTO_SIDE, POST_PHOTOS_MAX, POST_TEXT_MAX, uploadPhoto, type Post, type PostKind } from "@/lib/api/social";
import { shrinkPhoto } from "@/lib/photo";
import { useOnSignedOut } from "./session";
import styles from "./social.module.css";

/** A photo starts uploading as soon as it is chosen, so Post is quick. */
interface Draft {
  key: string;
  file: File;
  preview: string;
  status: "uploading" | "ready" | "failed";
  id?: string;
}

/** Write a post with up to four photos. Ctrl or Cmd + Enter posts. Photos can be pasted in. */
export function Composer({ me, kind = "personal", onPosted }: { me: User; kind?: PostKind; onPosted: (post: Post) => void }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [posting, setPosting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const textArea = useRef<HTMLTextAreaElement>(null);
  const previews = useRef(new Set<string>());

  useEffect(() => {
    const urls = previews.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  // Grows with the text instead of scrolling inside itself.
  useEffect(() => {
    const el = textArea.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  }, [text]);

  const update = (key: string, changes: Partial<Draft>) => setDrafts((list) => list.map((d) => (d.key === key ? { ...d, ...changes } : d)));

  const upload = async (draft: Draft) => {
    update(draft.key, { status: "uploading" });
    try {
      const photo = await uploadPhoto(await shrinkPhoto(draft.file, POST_PHOTO_SIDE));
      update(draft.key, { status: "ready", id: photo.id });
    } catch (err) {
      if (onSignedOut(err)) return;
      update(draft.key, { status: "failed" });
      toast(err instanceof Error && err.name === "ApiError" ? formError(err).message : "That file is not a photo we can read.", "danger");
    }
  };

  const add = (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/")).slice(0, POST_PHOTOS_MAX - drafts.length);
    if (images.length === 0) return;
    const added = images.map((file): Draft => {
      const preview = URL.createObjectURL(file);
      previews.current.add(preview);
      return { key: preview, file, preview, status: "uploading" };
    });
    setDrafts((list) => [...list, ...added]);
    added.forEach(upload);
  };

  const removeDraft = (key: string) => {
    URL.revokeObjectURL(key);
    previews.current.delete(key);
    setDrafts((list) => list.filter((d) => d.key !== key));
  };

  const onPaste = (event: ClipboardEvent) => {
    const files = Array.from(event.clipboardData.files);
    if (files.length && drafts.length < POST_PHOTOS_MAX) {
      event.preventDefault();
      add(files);
    }
  };

  const uploading = drafts.some((d) => d.status === "uploading");
  const broken = drafts.some((d) => d.status === "failed");
  const ready = (text.trim().length > 0 || drafts.length > 0) && !uploading && !broken;

  const submit = async () => {
    if (!ready || posting) return;
    setPosting(true);
    try {
      const post = await createPost({ text: text.trim(), mediaIds: drafts.map((d) => d.id!), kind });
      onPosted(post);
      setText("");
      drafts.forEach((d) => removeDraft(d.key));
      toast("Posted.", "success");
    } catch (err) {
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setPosting(false);
    }
  };

  return (
    <section className={styles.composer} aria-label="New post">
      <Avatar name={me.name} url={me.avatarUrl} size={44} />
      <div className={styles.composerBody}>
        <textarea
          ref={textArea}
          className={styles.composerText}
          value={text}
          maxLength={POST_TEXT_MAX}
          placeholder={kind === "business" ? "Share an offer, new stock or an update" : `What's happening, ${me.name.split(" ")[0]}?`}
          aria-label="Post text"
          rows={2}
          onChange={(e) => setText(e.target.value)}
          onPaste={onPaste}
          onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && submit()}
        />
        {drafts.length > 0 && (
          <ul className={styles.thumbs}>
            {drafts.map((d) => (
              <li key={d.key} className={styles.thumb} data-status={d.status}>
                <img src={d.preview} alt="" />
                {d.status === "uploading" && <span className={styles.thumbSpinner} aria-label="Uploading" />}
                {d.status === "failed" && (
                  <button type="button" className={styles.thumbRetry} onClick={() => upload(d)} aria-label="Upload failed. Try again.">
                    <Icon name="refresh" size={20} />
                  </button>
                )}
                <button type="button" className={styles.thumbRemove} onClick={() => removeDraft(d.key)} aria-label="Remove photo">
                  <Icon name="close" size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className={styles.composerBar}>
          <button
            type="button"
            className={styles.tool}
            onClick={() => fileInput.current?.click()}
            disabled={drafts.length >= POST_PHOTOS_MAX}
            aria-label={`Add photos, ${POST_PHOTOS_MAX - drafts.length} left`}
            title="Add photos"
          >
            <Icon name="image" size={22} />
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              add(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
          {text.length > POST_TEXT_MAX - 100 && (
            <span className={styles.count} data-near={text.length > POST_TEXT_MAX - 20 || undefined}>
              {POST_TEXT_MAX - text.length}
            </span>
          )}
          <Button onClick={submit} loading={posting} disabled={!ready}>
            {uploading ? "Uploading…" : "Post"}
          </Button>
        </div>
      </div>
    </section>
  );
}
