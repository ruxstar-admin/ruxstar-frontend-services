"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent, type PointerEvent } from "react";
import { Avatar } from "@/components/profile/Avatar";
import { Button, Icon, Segmented, useToast } from "@/components/ui";
import { formError, type User } from "@/lib/api/account";
import { createPost, POST_PHOTO_SIDE, POST_PHOTOS_MAX, POST_TEXT_MAX, uploadPhoto, type Post, type PostKind } from "@/lib/api/social";
import { shrinkPhoto } from "@/lib/photo";
import { useOnSignedOut } from "./session";
import styles from "./social.module.css";

const SHAPES = [
  { value: "original", label: "Original" },
  { value: "square", label: "Square" },
  { value: "portrait", label: "Portrait" },
] as const;
type Shape = (typeof SHAPES)[number]["value"];
/** Width / height each shape cuts to. Original sends the photo as it is; the API holds it between 4:5 and 1.91:1. */
const SHAPE_RATIO: Record<Shape, number | undefined> = { original: undefined, square: 1, portrait: 0.8 };
/** A thumb and the gap after it, in px; the strip reorders by whole steps. */
const STEP = 80;
const DRAG_START = 6;

/** A photo starts uploading as soon as it is chosen, so Post is quick. `job` tells a stale upload from the latest one. */
interface Draft {
  key: string;
  file: File;
  preview: string;
  status: "uploading" | "ready" | "failed";
  id?: string;
  job: number;
  /** Width / height, once the preview has loaded. */
  ratio?: number;
}

interface Drag {
  key: string;
  pointer: number;
  /** Where the pointer would be if the thumb sat in its current slot. */
  originX: number;
  moved: boolean;
  dx: number;
}

const clampRatio = (ratio: number) => Math.min(1.91, Math.max(0.8, ratio));

/**
 * Write a post with up to four photos, as in the app: photos first, with a shape for all of them and an order you
 * drag them into, then the caption. Ctrl or Cmd + Enter posts. Photos can be pasted or dropped in.
 */
export function Composer({
  me,
  kind = "personal",
  businessId,
  onPosted,
}: {
  me: User;
  kind?: PostKind;
  businessId?: string;
  onPosted: (post: Post) => void;
}) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [shape, setShape] = useState<Shape>("original");
  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [dropping, setDropping] = useState(false);
  const [posting, setPosting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const textArea = useRef<HTMLTextAreaElement>(null);
  const previews = useRef(new Set<string>());
  const jobs = useRef(0);

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

  const shown = drafts.find((d) => d.key === selected) ?? drafts[0];
  const frame = SHAPE_RATIO[shape] ?? clampRatio(drafts[0]?.ratio ?? 1);

  const upload = async (draft: Draft, cut: Shape = shape) => {
    const job = ++jobs.current;
    const settle = (changes: Partial<Draft>) =>
      setDrafts((list) => list.map((d) => (d.key === draft.key && d.job === job ? { ...d, ...changes } : d)));
    setDrafts((list) => list.map((d) => (d.key === draft.key ? { ...d, job, status: "uploading", id: undefined } : d)));
    try {
      const photo = await uploadPhoto(await shrinkPhoto(draft.file, POST_PHOTO_SIDE, SHAPE_RATIO[cut]));
      settle({ status: "ready", id: photo.id });
    } catch (err) {
      if (onSignedOut(err)) return;
      settle({ status: "failed" });
      toast(err instanceof Error && err.name === "ApiError" ? formError(err).message : "That file is not a photo we can read.", "danger");
    }
  };

  const add = (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/")).slice(0, POST_PHOTOS_MAX - drafts.length);
    if (images.length === 0) return;
    const added = images.map((file): Draft => {
      const preview = URL.createObjectURL(file);
      previews.current.add(preview);
      return { key: preview, file, preview, status: "uploading", job: 0 };
    });
    setDrafts((list) => [...list, ...added]);
    setSelected(added[0]!.key);
    added.forEach((d) => upload(d));
  };

  const removeDraft = (key: string) => {
    URL.revokeObjectURL(key);
    previews.current.delete(key);
    setDrafts((list) => list.filter((d) => d.key !== key));
  };

  const move = (from: number, to: number) =>
    setDrafts((list) => {
      if (to < 0 || to >= list.length) return list;
      const next = [...list];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);
      return next;
    });

  const changeShape = (next: Shape) => {
    if (next === shape) return;
    setShape(next);
    drafts.forEach((d) => upload(d, next));
  };

  const onPaste = (event: ClipboardEvent) => {
    const files = Array.from(event.clipboardData.files);
    if (files.length && drafts.length < POST_PHOTOS_MAX) {
      event.preventDefault();
      add(files);
    }
  };

  const onDrop = (event: DragEvent) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    setDropping(false);
    add(Array.from(event.dataTransfer.files));
  };

  // Thumbs reorder by dragging sideways with a mouse, pen or finger; a press that does not move selects.
  const onThumbDown = (event: PointerEvent<HTMLLIElement>, key: string) => {
    if ((event.target as HTMLElement).closest("button[data-remove]")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ key, pointer: event.pointerId, originX: event.clientX, moved: false, dx: 0 });
  };
  const onThumbMove = (event: PointerEvent<HTMLLIElement>) => {
    if (!drag || drag.pointer !== event.pointerId) return;
    const dx = event.clientX - drag.originX;
    if (!drag.moved && Math.abs(dx) < DRAG_START) return;
    const from = drafts.findIndex((d) => d.key === drag.key);
    const to = Math.min(drafts.length - 1, Math.max(0, from + Math.round(dx / STEP)));
    if (to !== from) move(from, to);
    setDrag({ ...drag, moved: true, originX: drag.originX + (to - from) * STEP, dx: dx - (to - from) * STEP });
  };
  const onThumbUp = (event: PointerEvent<HTMLLIElement>) => {
    if (!drag || drag.pointer !== event.pointerId) return;
    if (!drag.moved) {
      setSelected(drag.key);
      const draft = drafts.find((d) => d.key === drag.key);
      if (draft?.status === "failed") upload(draft);
    }
    setDrag(null);
  };
  const onThumbKey = (event: KeyboardEvent, index: number, key: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      return setSelected(key);
    }
    if (!event.altKey) return;
    const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (!step) return;
    event.preventDefault();
    move(index, index + step);
  };

  const uploading = drafts.some((d) => d.status === "uploading");
  const broken = drafts.some((d) => d.status === "failed");
  const ready = (text.trim().length > 0 || drafts.length > 0) && !uploading && !broken;
  const room = POST_PHOTOS_MAX - drafts.length;

  const submit = async () => {
    if (!ready || posting) return;
    setPosting(true);
    try {
      const post = await createPost({ text: text.trim(), mediaIds: drafts.map((d) => d.id!), kind, ...(kind === "business" && businessId ? { businessId } : {}) });
      onPosted(post);
      setText("");
      drafts.forEach((d) => removeDraft(d.key));
      setShape("original");
      toast("Posted.", "success");
    } catch (err) {
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setPosting(false);
    }
  };

  const pickers = (
    <>
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
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          add(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
    </>
  );

  return (
    <section
      className={styles.composer}
      aria-label="New post"
      data-dropping={dropping || undefined}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files") || room === 0) return;
        e.preventDefault();
        setDropping(true);
      }}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDropping(false)}
      onDrop={onDrop}
    >
      <Avatar name={me.name} url={me.avatarUrl} size={44} />
      <div className={styles.composerBody}>
        {shown && (
          <div className={styles.composePhotos}>
            <div className={styles.composePreview} style={{ aspectRatio: frame }} data-status={shown.status}>
              <img
                src={shown.preview}
                alt="Selected photo"
                onLoad={(e) => {
                  const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
                  if (w && h && !shown.ratio) setDrafts((list) => list.map((d) => (d.key === shown.key ? { ...d, ratio: w / h } : d)));
                }}
              />
              {shown.status === "uploading" && <span className={styles.thumbSpinner} aria-label="Uploading" />}
              {shown.status === "failed" && (
                <button type="button" className={styles.previewRetry} onClick={() => upload(shown)}>
                  <Icon name="refresh" size={22} /> Try again
                </button>
              )}
            </div>
            <Segmented label="Photo shape" options={SHAPES} value={shape} onChange={changeShape} />
            <ol className={styles.strip} aria-label="Photos in posting order" aria-describedby="strip-help">
              {drafts.map((d, i) => {
                const dragging = drag?.key === d.key && drag.moved;
                return (
                  <li
                    key={d.key}
                    className={styles.stripThumb}
                    data-status={d.status}
                    data-on={d.key === shown.key || undefined}
                    data-dragging={dragging || undefined}
                    style={dragging ? { transform: `translateX(${drag.dx}px) scale(1.06)` } : undefined}
                    tabIndex={0}
                    role="button"
                    aria-label={`Photo ${i + 1} of ${drafts.length}${d.status === "failed" ? ", did not upload" : ""}`}
                    aria-pressed={d.key === shown.key}
                    aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight"
                    onPointerDown={(e) => onThumbDown(e, d.key)}
                    onPointerMove={onThumbMove}
                    onPointerUp={onThumbUp}
                    onPointerCancel={() => setDrag(null)}
                    onKeyDown={(e) => onThumbKey(e, i, d.key)}
                  >
                    <img src={d.preview} alt="" draggable={false} />
                    {d.status === "uploading" && <span className={styles.thumbSpinner} aria-hidden />}
                    {d.status === "failed" && (
                      <span className={styles.stripFailed} aria-hidden>
                        <Icon name="alert" size={20} />
                      </span>
                    )}
                    <button type="button" data-remove className={styles.thumbRemove} onClick={() => removeDraft(d.key)} aria-label={`Remove photo ${i + 1}`}>
                      <Icon name="close" size={14} />
                    </button>
                  </li>
                );
              })}
              {room > 0 && (
                <li>
                  <button type="button" className={styles.stripAdd} onClick={() => fileInput.current?.click()} aria-label={`Add photos, ${room} left`}>
                    <Icon name="plus" size={22} />
                  </button>
                </li>
              )}
            </ol>
            <p id="strip-help" className={broken ? styles.stripError : styles.stripHelp}>
              {broken
                ? "A photo did not upload. Click it to try again, or remove it."
                : drafts.length > 1
                  ? "Drag a photo to change the order, or press Alt and an arrow key."
                  : `You can add ${room} more.`}
            </p>
          </div>
        )}
        <textarea
          ref={textArea}
          className={styles.composerText}
          value={text}
          maxLength={POST_TEXT_MAX}
          placeholder={drafts.length > 0 ? "Write a caption" : kind === "business" ? "Share an offer, new stock or an update" : `What's happening, ${me.name.split(" ")[0]}?`}
          aria-label={drafts.length > 0 ? "Caption" : "Post text"}
          rows={2}
          onChange={(e) => setText(e.target.value)}
          onPaste={onPaste}
          onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && submit()}
        />
        <div className={styles.composerBar}>
          <div className={styles.tools}>
            <button type="button" className={styles.photoTool} onClick={() => fileInput.current?.click()} disabled={room === 0} aria-label={`Add photos, ${room} left`}>
              <Icon name="image" size={20} />
              <span>Photos</span>
            </button>
            <button type="button" className={`${styles.photoTool} ${styles.cameraTool}`} onClick={() => cameraInput.current?.click()} disabled={room === 0}>
              <Icon name="camera" size={20} />
              <span>Camera</span>
            </button>
            {pickers}
          </div>
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
