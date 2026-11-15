"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Avatar } from "@/components/profile/Avatar";
import { Button, Icon } from "@/components/ui";
import { formError } from "@/lib/api/account";
import {
  deleteReview,
  moduleOf,
  myReview,
  REPLY_FROM,
  REPORT_REASONS,
  reportReview,
  REVIEW_TEXT_MAX,
  STAR_WORDS,
  starsLabel,
  writeReview,
  type MyReview,
  type Review,
  type ReviewModule,
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

/**
 * One review: who, the stars, what they bought, what they wrote and the business's reply. Same as the app.
 * `hideProduct` is for an event's or a course's own page, where what they bought is the page.
 */
export function ReviewCard({ review, extra, hideProduct, children }: { review: Review; extra?: string; hideProduct?: boolean; children?: ReactNode }) {
  const name = review.author?.name ?? "A customer";
  const meta = [hideProduct ? null : review.product, extra, `${ago(review.createdAt)}${review.editedAt ? " · edited" : ""}`].filter(Boolean).join(" · ");
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
          <span className={styles.replyLabel}>{`${REPLY_FROM[moduleOf(review)]}${review.reply.editedAt ? " · edited" : ""}`}</span>
          <p className={styles.text}>{review.reply.text}</p>
        </div>
      )}
      {children}
    </article>
  );
}

/** What the rating card says, per kind of order. */
export interface RateWords {
  /** "Rate your order", "Rate this event". */
  ask: string;
  /** Under the ask: why it helps. */
  askLine: string;
  /** Over the form for a new review. */
  writeTitle: string;
  placeholder: string;
}

function WriteForm({
  orderId,
  module,
  words,
  review,
  start,
  onSaved,
  onClose,
  onDelete,
}: {
  orderId: string;
  module: ReviewModule;
  words: RateWords;
  review: MyReview | null;
  start: number;
  onSaved: (r: MyReview) => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const [rating, setRating] = useState(start);
  const [text, setText] = useState(review?.text ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      onSaved(await writeReview(orderId, { rating, text: text.trim() || null }, module));
    } catch (err) {
      setError(formError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={order.news}>
      <strong>{review ? "Change your review" : words.writeTitle}</strong>
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
        placeholder={words.placeholder}
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
        {review && (
          <Button variant="secondary" icon={<Icon name="trash" size={16} />} disabled={saving} onClick={onDelete}>
            Delete review
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * "Rate …" while the order is open for a review and has none, then just the stars given, changeable and deletable
 * until `until`. `open` comes from the order (`reviewUntil` for print, `canReview` for events and coaching).
 */
export function Rate({ orderId, module, open, until, words }: { orderId: string; module: ReviewModule; open: boolean; until: string | null; words: RateWords }) {
  const [review, setReview] = useState<MyReview | null | undefined>(undefined);
  const [writing, setWriting] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    myReview(orderId, module).then(
      (r) => live && setReview(r),
      () => live && setReview(null),
    );
    return () => {
      live = false;
    };
  }, [orderId, module]);

  if (review === undefined) return null;

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteReview(orderId, module);
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
        orderId={orderId}
        module={module}
        words={words}
        review={review}
        start={writing}
        onClose={() => setWriting(null)}
        onSaved={(next) => {
          setWriting(null);
          setReview(next);
        }}
        onDelete={() => {
          setWriting(null);
          setDeleting(true);
        }}
      />
    );
  }

  if (!review) {
    if (!open) return null;
    return (
      <div className={styles.ask}>
        <strong>{words.ask}</strong>
        <p className={styles.muted}>{words.askLine}</p>
        <StarPicker value={0} onChange={setWriting} />
        {until && module !== "pod" && <span className={styles.faint}>{`You can review it until ${exact(until)}`}</span>}
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
      <div className={styles.rated}>
        <span className={styles.ratedText}>
          <strong>{`You rated it ${review.rating} ${review.rating === 1 ? "star" : "stars"}`}</strong>
          <Stars value={review.rating} size={16} />
          {open && until && <span className={styles.faint}>{`You can change it until ${exact(until)}`}</span>}
        </span>
        {open && !deleting && (
          <Button variant="secondary" icon={<Icon name="edit" size={16} />} onClick={() => setWriting(review.rating)}>
            Change
          </Button>
        )}
      </div>
      {deleting && (
        <div className={order.actions}>
          <Button variant="danger" loading={busy} onClick={() => void remove()}>
            Delete review
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => setDeleting(false)}>
            Keep it
          </Button>
        </div>
      )}
      {error && (
        <p className={order.error} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

/** On a delivered order: "Rate your order" until it's reviewed, then just the stars given, changeable for 30 days after delivery. Same as the app. */
export function RateOrder({ order: o }: { order: Order }) {
  return (
    <Rate
      orderId={o.id}
      module="pod"
      open={o.reviewUntil !== null}
      until={o.reviewUntil}
      words={{
        ask: "Rate your order",
        askLine: `How was ${o.shop.name}? It helps other customers choose.`,
        writeTitle: `Rate ${o.shop.name}`,
        placeholder: "Print quality, on time, how the shop was to deal with",
      }}
    />
  );
}

/** Report a review to Ruxstar: why, and a note if you like. The writer isn't told. */
export function ReportForm({ reviewId, module = "pod", onDone, onClose }: { reviewId: string; module?: ReviewModule; onDone: () => void; onClose: () => void }) {
  const [reason, setReason] = useState<ReviewReportReason>("spam");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      await reportReview(reviewId, reason, note.trim() || undefined, module);
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
