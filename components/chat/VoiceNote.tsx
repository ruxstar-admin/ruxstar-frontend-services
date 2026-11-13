"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui";
import { clockOf } from "./thread-layout";
import styles from "./chat.module.css";

const BARS = 28;

/** Only one voice message plays at a time: starting one pauses the last. */
let playing: HTMLAudioElement | null = null;

/** The waveform as BARS bars, from the recording's loudness, or a gentle placeholder when it has none. Same as the app. */
function waveform(levels: number[], bars = BARS): number[] {
  if (levels.length === 0) return Array.from({ length: bars }, (_, i) => 30 + 20 * Math.sin(i * 0.9));
  return Array.from({ length: bars }, (_, i) => {
    const from = Math.floor((i * levels.length) / bars);
    const to = Math.max(from + 1, Math.floor(((i + 1) * levels.length) / bars));
    const slice = levels.slice(from, to);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

/** A voice message: play or pause, its waveform filling as it plays, and the time left. */
export function VoiceNote({ url, durationMs, levels }: { url: string; durationMs: number; levels: number[] }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [on, setOn] = useState(false);
  const [at, setAt] = useState(0);
  const bars = waveform(levels);
  const progress = durationMs > 0 ? Math.min(1, at / durationMs) : 0;

  useEffect(() => {
    const el = audio.current;
    return () => {
      if (playing === el) playing = null;
    };
  }, []);

  const toggle = () => {
    const el = audio.current;
    if (!el) return;
    if (!el.paused) return el.pause();
    if (playing && playing !== el) playing.pause();
    playing = el;
    el.play().catch(() => setOn(false));
  };

  return (
    <span className={styles.voice}>
      <audio
        ref={audio}
        src={url}
        preload="none"
        onPlay={() => setOn(true)}
        onPause={() => setOn(false)}
        onTimeUpdate={(e) => setAt(e.currentTarget.currentTime * 1000)}
        onEnded={(e) => {
          e.currentTarget.currentTime = 0;
          setAt(0);
          setOn(false);
        }}
      />
      <button type="button" className={styles.voicePlay} aria-label={on ? "Pause voice message" : `Play voice message, ${clockOf(durationMs)}`} onClick={toggle}>
        <Icon name={on ? "pause" : "play"} size={16} filled={!on} />
      </button>
      <span className={styles.voiceBars} aria-hidden>
        {bars.map((level, i) => (
          <span key={i} style={{ height: `${Math.max(4, (level / 100) * 24)}px` }} data-played={(i + 0.5) / bars.length <= progress || undefined} />
        ))}
      </span>
      <span className={styles.voiceTime}>{clockOf(on || at > 0 ? durationMs - at : durationMs)}</span>
    </span>
  );
}
