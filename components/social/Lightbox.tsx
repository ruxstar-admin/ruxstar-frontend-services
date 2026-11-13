"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from "react";
import { Icon } from "@/components/ui";
import { photoSrcSet, type Photo } from "@/lib/api/social";
import styles from "./Lightbox.module.css";

const ZOOM = 2.5;
const DISMISS_DISTANCE = 120;

/** The size a photo is drawn at to fit the screen, and at `scale` times that. */
function fitted(photo: Photo, scale: number) {
  const ratio = photo.width > 0 && photo.height > 0 ? photo.width / photo.height : 1;
  const width = Math.min(window.innerWidth, window.innerHeight * ratio);
  return { width: width * scale, height: (width / ratio) * scale };
}

/**
 * A post's photos full screen on black. Arrow keys, the side buttons or a swipe move between them; a
 * double-click zooms where it lands, and a zoomed photo can be dragged. Esc, ×, a click beside the photo
 * or a swipe down on a phone closes it.
 */
export function Lightbox({ photos, start, onClose }: { photos: Photo[]; start: number; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(start);
  const [zoomed, setZoomed] = useState(false);
  const [dragY, setDragY] = useState(0);
  const swipe = useRef<{ id: number; y: number; x: number } | null>(null);
  const pan = useRef<{ id: number; x: number; y: number; left: number; top: number } | null>(null);
  const many = photos.length > 1;

  // Opened before the first paint, so the track has its width and starts on the chosen photo.
  useLayoutEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (!el.open) el.showModal();
    if (track.current) track.current.scrollLeft = start * track.current.clientWidth;
    // The page behind stays put while the photos are open.
    const { overflow } = document.documentElement.style;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = overflow;
    };
  }, [start]);

  const go = (to: number) => {
    const el = track.current;
    if (!el || to < 0 || to >= photos.length) return;
    setZoomed(false);
    el.scrollTo({ left: to * el.clientWidth, behavior: "smooth" });
  };

  const onScroll = () => {
    const el = track.current;
    if (el) setCurrent(Math.round(el.scrollLeft / el.clientWidth));
  };

  const toggleZoom = (event: MouseEvent<HTMLImageElement>, photo: Photo) => {
    const slide = event.currentTarget.parentElement;
    if (!slide) return;
    if (zoomed) return setZoomed(false);
    const box = event.currentTarget.getBoundingClientRect();
    const across = (event.clientX - box.left) / box.width;
    const down = (event.clientY - box.top) / box.height;
    setZoomed(true);
    // After the larger photo is laid out, put the point that was clicked in the middle of the screen.
    requestAnimationFrame(() => {
      const size = fitted(photo, ZOOM);
      slide.scrollLeft = across * size.width - slide.clientWidth / 2;
      slide.scrollTop = down * size.height - slide.clientHeight / 2;
    });
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const slide = event.currentTarget;
    if (zoomed && event.pointerType === "mouse") {
      pan.current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: slide.scrollLeft, top: slide.scrollTop };
      slide.setPointerCapture(event.pointerId);
    } else if (!zoomed && event.pointerType === "touch") {
      swipe.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    }
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const p = pan.current;
    if (p?.id === event.pointerId) {
      event.currentTarget.scrollLeft = p.left - (event.clientX - p.x);
      event.currentTarget.scrollTop = p.top - (event.clientY - p.y);
      return;
    }
    const s = swipe.current;
    if (s?.id !== event.pointerId) return;
    const dy = event.clientY - s.y;
    // A sideways move is the track scrolling to the next photo, not a swipe to close.
    if (Math.abs(event.clientX - s.x) > Math.abs(dy) && dragY === 0) {
      swipe.current = null;
      return;
    }
    setDragY(dy);
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (pan.current?.id === event.pointerId) pan.current = null;
    if (swipe.current?.id !== event.pointerId) return;
    swipe.current = null;
    if (Math.abs(dragY) > DISMISS_DISTANCE) onClose();
    else setDragY(0);
  };

  return (
    <dialog
      ref={dialog}
      className={styles.lightbox}
      aria-label={many ? `Photo ${current + 1} of ${photos.length}` : "Photo"}
      onClose={onClose}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(current + 1);
        if (e.key === "ArrowLeft") go(current - 1);
      }}
      style={{ "--fade": Math.max(0.25, 1 - Math.abs(dragY) / 400) } as CSSProperties}
    >
      <div
        ref={track}
        className={styles.track}
        data-zoomed={zoomed || undefined}
        onScroll={onScroll}
        style={{ transform: dragY ? `translateY(${dragY}px)` : undefined, transition: dragY ? "none" : undefined }}
      >
        {photos.map((photo, i) => {
          const size = zoomed && i === current ? fitted(photo, ZOOM) : null;
          return (
            <div
              key={photo.url}
              className={styles.slide}
              data-zoomed={size ? true : undefined}
              onClick={(e) => e.target === e.currentTarget && !zoomed && onClose()}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <img
                src={photo.url}
                srcSet={photoSrcSet(photo)}
                sizes="100vw"
                width={photo.width}
                height={photo.height}
                alt=""
                decoding="async"
                loading={Math.abs(i - start) <= 1 ? "eager" : "lazy"}
                draggable={false}
                className={styles.photo}
                style={size ? { width: size.width, height: size.height, maxWidth: "none", maxHeight: "none" } : undefined}
                onDoubleClick={(e) => toggleZoom(e, photo)}
              />
            </div>
          );
        })}
      </div>

      <div className={styles.chrome}>
        <button type="button" className={styles.round} aria-label="Close photo" onClick={onClose} autoFocus>
          <Icon name="close" size={24} />
        </button>
        {many && (
          <span className={styles.counter} aria-live="polite">
            {current + 1} of {photos.length}
          </span>
        )}
      </div>
      {many && current > 0 && (
        <button type="button" className={`${styles.round} ${styles.side}`} data-side="left" aria-label="Previous photo" onClick={() => go(current - 1)}>
          <Icon name="arrow-left" size={22} />
        </button>
      )}
      {many && current < photos.length - 1 && (
        <button type="button" className={`${styles.round} ${styles.side}`} data-side="right" aria-label="Next photo" onClick={() => go(current + 1)}>
          <Icon name="arrow-right" size={22} />
        </button>
      )}
    </dialog>
  );
}
