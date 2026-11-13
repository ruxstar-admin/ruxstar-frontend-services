"use client";

import { useRef, useState, type PointerEvent } from "react";
import { Avatar } from "@/components/profile/Avatar";
import type { RuxstarCard as Card } from "@/lib/api/kyc";
import { QrCode } from "./QrCode";
import styles from "./kyc.module.css";

/** A drag past this share of the card's width, or a flick (px per ms), turns it over. */
const FLIP_DISTANCE = 0.3;
const FLIP_VELOCITY = 0.7;

const since = new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit", timeZone: "Asia/Kolkata" });
const memberSince = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : since.format(d).replace(" ", " '").toUpperCase();
};

const facing = (deg: number) => ((deg % 360) + 360) % 360;
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));

/**
 * The member card, as in the app: matte black with champagne accents. It rises in and floats gently.
 * A click turns it over; a sideways drag turns it with the pointer and it lands on whichever side it
 * was dragged to. The back has the profile QR code and the masked numbers, which only the owner sees.
 */
export function RuxstarCard({ card }: { card: Card }) {
  const [turn, setTurn] = useState(0);
  const [lean, setLean] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; at: number; base: number; moved: boolean } | null>(null);
  const back = facing(turn) > 90 && facing(turn) < 270;

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, at: e.timeStamp, base: Math.round(turn / 180) * 180, moved: false };
  };

  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (!d.moved) {
      if (Math.abs(dx) < 8) return;
      d.moved = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(true);
    }
    const { width, height } = e.currentTarget.getBoundingClientRect();
    setTurn(d.base + clamp((dx / width) * 180, -180, 180));
    setLean(clamp((-(e.clientY - d.y) / height) * 20, -8, 8));
  };

  const onPointerUp = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d?.moved) return;
    const dx = e.clientX - d.x;
    const moved = turn - d.base;
    const velocity = dx / Math.max(1, e.timeStamp - d.at);
    const over = Math.abs(moved) > FLIP_DISTANCE * 180 || Math.abs(velocity) > FLIP_VELOCITY;
    const direction = Math.abs(moved) > 1 ? Math.sign(moved) : Math.sign(velocity);
    setTurn(over ? d.base + direction * 180 : d.base);
    setLean(0);
    setDragging(false);
  };

  const onClick = () => {
    if (drag.current?.moved) {
      drag.current = null;
      return;
    }
    drag.current = null;
    setTurn((t) => Math.round(t / 180) * 180 + 180);
  };

  const name = card.name.trim();

  return (
    <div className={styles.cardStage}>
      <button
        type="button"
        className={styles.cardTurn}
        data-dragging={dragging || undefined}
        style={{ transform: `rotateX(${lean}deg) rotateY(${turn}deg)` }}
        aria-label={
          back
            ? `Back of your Ruxstar Card: profile QR code, Aadhaar ${card.aadhaar}${card.pan ? `, PAN ${card.pan}` : ""}. Turn the card over.`
            : `Ruxstar Card ${card.id}, ${name}, verified, member since ${memberSince(card.memberSince)}. Turn the card over.`
        }
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={onClick}
      >
        <span className={styles.cardFace} aria-hidden>
          <span className={styles.cardRow}>
            <span className={styles.cardBrand}>
              <span className={styles.cardStar}>✦</span>RUXSTAR
            </span>
            <span className={styles.cardPill}>
              <span className={styles.cardDot} />
              {card.vendor ? "VERIFIED · VENDOR" : "VERIFIED"}
            </span>
          </span>

          <span className={styles.cardRow}>
            <span className={styles.cardChipGroup}>
              <span className={styles.cardChip}>
                {Array.from({ length: 6 }, (_, i) => (
                  <span key={i} />
                ))}
              </span>
              <svg className={styles.cardContactless} viewBox="0 0 24 24" fill="none">
                <path d="M8.5 8.5a5 5 0 0 1 0 7" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
                <path d="M11.5 6a8 8 0 0 1 0 12" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" opacity={0.7} />
                <path d="M14.5 4a11 11 0 0 1 0 16" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" opacity={0.45} />
              </svg>
            </span>
            <span className={styles.cardPhoto}>
              <Avatar name={card.name} url={card.photoUrl} size="calc(42 * var(--u))" />
            </span>
          </span>

          <span className={styles.cardNumber}>{card.id.split("-").join("  ")}</span>

          <span className={`${styles.cardRow} ${styles.cardBottom}`}>
            <span className={styles.cardField}>
              <span className={styles.cardLabel}>Card holder</span>
              <span className={styles.cardValue}>{name ? name.toUpperCase() : "-"}</span>
            </span>
            <span className={`${styles.cardField} ${styles.cardEnd}`}>
              <span className={styles.cardLabel}>Member since</span>
              <span className={styles.cardValue}>{memberSince(card.memberSince)}</span>
            </span>
          </span>
        </span>

        <span className={styles.cardFace} data-back aria-hidden>
          <span className={styles.cardStripe} />
          <span className={styles.cardBack}>
            <span className={styles.cardQr}>
              <QrCode value={card.profileUrl} label="QR code to your public profile" />
            </span>
            <span className={styles.cardFacts}>
              <span className={styles.cardField}>
                <span className={styles.cardLabel}>Aadhaar</span>
                <span className={styles.cardMono}>{card.aadhaar}</span>
              </span>
              {card.pan && (
                <span className={styles.cardField}>
                  <span className={styles.cardLabel}>PAN</span>
                  <span className={styles.cardMono}>{card.pan}</span>
                </span>
              )}
              <span className={styles.cardLabel}>Scan to open profile</span>
            </span>
          </span>
        </span>
      </button>
    </div>
  );
}
