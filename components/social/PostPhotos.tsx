"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Icon } from "@/components/ui";
import { photoSrcSet, type Photo } from "@/lib/api/social";
import { Lightbox } from "./Lightbox";
import styles from "./PostPhotos.module.css";

/** The feed column is at most 640 px wide; on phones it is the screen less its margins. */
const SIZES = "(max-width: 640px) 100vw, 640px";
/** A second click within this long is a double-click, so a single click waits for it before opening. */
const DOUBLE_CLICK_MS = 240;

/** The API keeps photos between 4:5 and 1.91:1; older posts may not be, so the frame is held to the same range. */
const frameRatio = (photo: Photo) => Math.min(1.91, Math.max(0.8, photo.width > 0 && photo.height > 0 ? photo.width / photo.height : 1));

/**
 * A post's photos one at a time at the first photo's shape, as in the app: swipe or use the arrows for the
 * next, click to open full screen, double-click to like.
 */
export function PostPhotos({ photos, eager, onDoubleLike }: { photos: Photo[]; eager?: boolean; onDoubleLike?: () => void }) {
  const track = useRef<HTMLDivElement>(null);
  const pending = useRef<number | undefined>(undefined);
  const [current, setCurrent] = useState(0);
  const [viewing, setViewing] = useState<number | null>(null);
  const [burst, setBurst] = useState(0);
  const many = photos.length > 1;

  useEffect(() => () => window.clearTimeout(pending.current), []);

  if (photos.length === 0) return null;
  const ratio = frameRatio(photos[0]!);

  const go = (to: number) => {
    const el = track.current;
    if (el) el.scrollTo({ left: to * el.clientWidth, behavior: "smooth" });
  };

  const onClick = (event: MouseEvent, i: number) => {
    window.clearTimeout(pending.current);
    // Enter or Space on the focused photo reports no clicks: open straight away.
    if (event.detail === 0) return setViewing(i);
    if (event.detail >= 2) {
      setBurst((n) => n + 1);
      onDoubleLike?.();
      return;
    }
    pending.current = window.setTimeout(() => setViewing(i), DOUBLE_CLICK_MS);
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.frame} style={{ aspectRatio: ratio }}>
        <div ref={track} className={styles.track} onScroll={(e) => setCurrent(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
          {photos.map((photo, i) => (
            <button
              key={photo.url}
              type="button"
              className={styles.slide}
              aria-label={many ? `Open photo ${i + 1} of ${photos.length}` : "Open photo"}
              onClick={(e) => onClick(e, i)}
            >
              <img
                src={photo.url}
                srcSet={photoSrcSet(photo)}
                sizes={SIZES}
                width={photo.width}
                height={photo.height}
                alt=""
                loading={eager && i === 0 ? "eager" : "lazy"}
                fetchPriority={eager && i === 0 ? "high" : "auto"}
                decoding="async"
                draggable={false}
              />
            </button>
          ))}
        </div>

        {burst > 0 && (
          <span key={burst} className={styles.burst} aria-hidden>
            <Icon name="heart" filled size={96} />
          </span>
        )}

        {many && (
          <>
            <span className={styles.counter} aria-hidden>
              {current + 1}/{photos.length}
            </span>
            {current > 0 && (
              <button type="button" className={styles.side} data-side="left" aria-label="Previous photo" onClick={() => go(current - 1)}>
                <Icon name="arrow-left" size={18} />
              </button>
            )}
            {current < photos.length - 1 && (
              <button type="button" className={styles.side} data-side="right" aria-label="Next photo" onClick={() => go(current + 1)}>
                <Icon name="arrow-right" size={18} />
              </button>
            )}
          </>
        )}
      </div>

      {many && (
        <div className={styles.dots} aria-hidden>
          {photos.map((photo, i) => (
            <span key={photo.url} className={styles.dot} data-on={i === current || undefined} />
          ))}
        </div>
      )}

      {viewing !== null && <Lightbox photos={photos} start={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
