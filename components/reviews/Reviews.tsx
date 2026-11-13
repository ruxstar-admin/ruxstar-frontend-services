"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Avatar } from "@/components/profile/Avatar";
import { Button, Icon } from "@/components/ui";
import { formError } from "@/lib/api/account";
import {
  deleteReview,
  myReview,
  REPORT_REASONS,
  reportReview,
  REVIEW_TEXT_MAX,
  STAR_WORDS,
  starsLabel,
  writeReview,
  type MyReview,
  type Review,
  type ReviewReportReason,
} from "@/lib/api/reviews";
import type { Order } from "@/lib/api/orders";
import { ago, exact } from "@/lib/time";
import order from "@/components/shop/order.module.css";
import shop from "@/components/shop/shop.module.css";
import styles from "./reviews.module.css";

const STARS = [1, 2, 3, 4, 5];

/** A review's stars, read only. */
export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className={styles.stars} role="img" aria-label={starsLabel(value)}>
      {STARS.map((n) => (
        <span key={n} data-on={n <= value || undefined}>
          <Icon name="star" size={size} filled={n <= value} />
        </span>
      ))}
    </span>
  );
}

/** Five stars to click; 0 is none picked yet. */
export function StarPicker({ value, onChange, disabled }: { value: number; onChange: (n: number) => void; disabled?: boolean }) {
  return (
    <span className={styles.picker} role="radiogroup" aria-label="Rating">
      {STARS.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={n === value}
          aria-label={starsLabel(n)}
          className={styles.pickStar}
          data-on={n <= value || undefined}
          disabled={disabled}
          onClick={() => onChange(n)}
        >
          <Icon name="star" size={30} filled={n <= value} />
        </button>
      ))}
    </span>
  );
}

/** A small text action under a review. */
export function TextAction({ children, muted, onClick }: { children: ReactNode; muted?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={styles.link} data-muted={muted || undefined} onClick={onClick}>
      {children}
    </button>
  );
}

/** One review: who, the stars, what they ordered, what they wrote and the shop's reply. Same as the app. */
export function ReviewCard({ review, extra, children }: { review: Review; extra?: string; children?: ReactNode }) {
  const name = review.author?.name ?? "A customer";
  const meta = [review.product, extra, `${ago(review.createdAt)}${review.editedAt ? " · edited" : ""}`].filter(Boolean).join(" · ");
  return (
    <article className={styles.review}>
      <div className={styles.head}>
        <Avatar name={name} url={review.author?.avatarUrl ?? null} size={36} />
        <span className={styles.who}>
          <span className={styles.name}>{name}</span>
          <span className={styles.meta}>{meta}</span>
        </span>
        <Stars value={review.rating} />
      </div>
      {review.text && <p className={styles.text}>{review.text}</p>}
      {review.reply && (
        <div className={styles.reply}>
          <span className={styles.replyLabel}>{`From the shop${review.reply.editedAt ? " · edited" : ""}`}</span>
          <p className={styles.text}>{review.reply.text}</p>
        </div>
      )}
      {children}
    </article>
  );
}

function WriteForm({ orderOf, review, start, onSaved, onClose }: { orderOf: Order; review: MyReview | null; start: number; onSaved: (r: MyReview) => void; onClose: () => void }) {
  const [rating, setRating] = useState(start);
  const [text, setText] = useState(review?.text ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      onSaved(await writeReview(orderOf.id, { rating, text: text.trim() || null }));
    } catch (err) {
      setError(formError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={order.news}>
      <strong>{review ? "Change your review" : `Rate ${orderOf.shop.name}`}</strong>
      <div className={styles.center}>
        <StarPicker value={rating} onChange={setRating} disabled={saving} />
        <span className={styles.muted}>{rating ? STAR_WORDS[rating] : "Pick the stars"}</span>
      </div>
      <label className={order.label} htmlFor="review-text">
        Tell others about it (optional)
      </label>
      <textarea
        id="review-text"
        className={order.textarea}
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={REVIEW_TEXT_MAX}
        placeholder="Print quality, on time, how the shop was to deal with"
      />
      <p className={order.faint}>{`${text.length}/${REVIEW_TEXT_MAX} · Your name and photo show with your review.`}</p>
      {error && (
        <p className={order.error} role="alert">
          {error}
        </p>
      )}
      <div className={order.actions}>
        <Button loading={saving} disabled={!rating} onClick={() => void save()}>
          {review ? "Save changes" : "Post review"}
        </Button>
        <Button variant="ghost" disabled={saving} onClick={onClose}>
          Not now
        </Button>
      </div>
    </div>
  );
}

/** On a delivered order: "Rate your order" until it's reviewed, then the review, changeable for 30 days after delivery. Same as the app. */
export function RateOrder({ order: o }: { order: Order }) {
  const [review, setReview] = useState<MyReview | null | undefined>(undefined);
  const [writing, setWriting] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = o.reviewUntil !== null;

  useEffect(() => {
    let live = true;
    myReview(o.id).then(
      (r) => live && setReview(r),
      () => live && setReview(null),
    );
    return () => {
      live = false;
    };
  }, [o.id]);

  if (review === undefined) return null;

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteReview(o.id);
      setReview(null);
      setDeleting(false);
    } catch (err) {
      setError(formError(err).message);
    } finally {
      setBusy(false);
    }
  };

  if (writing !== null) {
    return (
      <WriteForm
        orderOf={o}
        review={review}
        start={writing}
        onClose={() => setWriting(null)}
        onSaved={(next) => {
          setWriting(null);
          setReview(next);
        }}
      />
    );
  }

  if (!review) {
    if (!open) return null;
    return (
      <div className={styles.ask}>
        <strong>Rate your order</strong>
        <p className={styles.muted}>{`How was ${o.shop.name}? It helps other customers choose.`}</p>
        <StarPicker value={0} onChange={setWriting} />
      </div>
    );
  }

  if (review.status === "removed") {
    return (
      <section className={order.section}>
        <h2 className={order.overline}>Your review</h2>
        <div className={styles.removed}>
          <strong>Ruxstar removed your review</strong>
          {review.removedReason && <p className={styles.muted}>{review.removedReason}</p>}
        </div>
      </section>
    );
  }

  return (
    <section className={order.section}>
      <h2 className={order.overline}>Your review</h2>
      <ReviewCard review={review}>
        {open &&
          (deleting ? (
            <div className={order.actions}>
              <Button variant="danger" loading={busy} onClick={() => void remove()}>
                Delete review
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => setDeleting(false)}>
                Keep it
              </Button>
            </div>
          ) : (
            <div className={styles.actions}>
              <TextAction onClick={() => setWriting(review.rating)}>Edit</TextAction>
              <TextAction muted onClick={() => setDeleting(true)}>
                Delete
              </TextAction>
              <span className={styles.faint}>{`Until ${exact(o.reviewUntil!)}`}</span>
            </div>
          ))}
      </ReviewCard>
      {error && (
        <p className={order.error} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

/** Report a review to Ruxstar: why, and a note if you like. The writer isn't told. */
export function ReportForm({ reviewId, onDone, onClose }: { reviewId: string; onDone: () => void; onClose: () => void }) {
  const [reason, setReason] = useState<ReviewReportReason>("spam");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      await reportReview(reviewId, reason, note.trim() || undefined);
      onDone();
    } catch (err) {
      setError(formError(err).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={order.news}>
      <strong>Report this review</strong>
      <p className={order.small}>{"Ruxstar looks at it and removes it if it breaks the rules. The writer isn't told who reported it."}</p>
      <div className={shop.chips} role="group" aria-label="Why">
        {REPORT_REASONS.map((r) => (
          <button key={r.key} type="button" className={shop.chip} aria-pressed={reason === r.key} onClick={() => setReason(r.key)}>
            {r.label}
          </button>
        ))}
      </div>
      <label className={order.label} htmlFor={`report-${reviewId}`}>
        Anything to add (optional)
      </label>
      <textarea id={`report-${reviewId}`} className={order.textarea} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
      {error && (
        <p className={order.error} role="alert">
          {error}
        </p>
      )}
      <div className={order.actions}>
        <Button loading={sending} onClick={() => void send()}>
          Send to Ruxstar
        </Button>
        <Button variant="ghost" disabled={sending} onClick={onClose}>
          Not now
        </Button>
      </div>
    </div>
  );
}
