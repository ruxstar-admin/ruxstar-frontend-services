"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/** The API's limit; recording stops itself here. */
export const VOICE_MAX_MS = 2 * 60_000;
/** Shorter than this is a slip of the finger, not a message. */
const VOICE_MIN_MS = 700;
const LEVELS = 48;
const TICK_MS = 100;
/** Only AAC in MP4 plays everywhere, iPhones included, so other formats aren't offered. */
const AAC_TYPES = ['audio/mp4;codecs="mp4a.40.2"', "audio/mp4;codecs=mp4a.40.2"];

export interface VoiceRecording {
  blob: Blob;
  durationMs: number;
  /** 0-100 loudness bars for its waveform. */
  levels: number[];
}

/** The AAC type this browser can record, or null (e.g. Firefox), in which case there is no mic button. */
function aacType(): string | null {
  if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) return null;
  const explicit = AAC_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
  if (explicit) return explicit;
  // Safari records AAC for plain audio/mp4; browsers that can also put Opus in MP4 might not.
  return MediaRecorder.isTypeSupported("audio/mp4") && !MediaRecorder.isTypeSupported("audio/mp4;codecs=opus") ? "audio/mp4" : null;
}

const noSubscribe = () => () => {};

/** Squeezes the loudness samples into at most LEVELS bars. */
function squeeze(samples: number[], bars = LEVELS): number[] {
  if (samples.length <= bars) return samples;
  return Array.from({ length: bars }, (_, i) => {
    const from = Math.floor((i * samples.length) / bars);
    const to = Math.floor(((i + 1) * samples.length) / bars);
    return Math.max(...samples.slice(from, to));
  });
}

/** Loudness of the latest audio as a 0-100 bar, on the same scale as the app. */
function levelOf(analyser: AnalyserNode, buffer: Float32Array<ArrayBuffer>) {
  analyser.getFloatTimeDomainData(buffer);
  let sum = 0;
  for (const v of buffer) sum += v * v;
  const db = 20 * Math.log10(Math.sqrt(sum / buffer.length) || 1e-8);
  return Math.round(Math.min(1, Math.max(0, (db + 55) / 55)) * 100);
}

interface Session {
  recorder: MediaRecorder;
  stream: MediaStream;
  context: AudioContext;
  chunks: Blob[];
  samples: number[];
  startedAt: number;
  timer: number;
}

/**
 * Records a voice message in the browser: start asks for the microphone the first time, stop hands back the
 * file with its length and waveform, cancel throws it away. `denied` when the microphone is blocked.
 */
export function useVoiceRecorder(onLimit: (recording: VoiceRecording) => void) {
  const supported = useSyncExternalStore(noSubscribe, () => aacType() !== null, () => false);
  const [recording, setRecording] = useState(false);
  const [denied, setDenied] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const [live, setLive] = useState<number[]>([]);
  const session = useRef<Session | null>(null);
  const limit = useRef(onLimit);

  useEffect(() => {
    limit.current = onLimit;
  });

  const close = (s: Session) => {
    window.clearInterval(s.timer);
    s.stream.getTracks().forEach((t) => t.stop());
    s.context.close().catch(() => undefined);
    session.current = null;
    setRecording(false);
    setDurationMs(0);
    setLive([]);
  };

  /** Ends the recording: the file, or null when it was too short or failed. */
  const stop = (): Promise<VoiceRecording | null> => {
    const s = session.current;
    if (!s) return Promise.resolve(null);
    session.current = null;
    window.clearInterval(s.timer);
    const elapsed = Math.min(VOICE_MAX_MS, Date.now() - s.startedAt);
    return new Promise((resolve) => {
      s.recorder.onstop = () => {
        const blob = new Blob(s.chunks, { type: "audio/mp4" });
        close(s);
        resolve(elapsed >= VOICE_MIN_MS && blob.size > 0 ? { blob, durationMs: elapsed, levels: squeeze(s.samples) } : null);
      };
      if (s.recorder.state === "inactive") s.recorder.onstop(new Event("stop"));
      else s.recorder.stop();
    });
  };

  const cancel = () => {
    const s = session.current;
    if (!s) return;
    s.recorder.onstop = null;
    if (s.recorder.state !== "inactive") s.recorder.stop();
    close(s);
  };

  useEffect(() => cancel, []);

  const start = async (): Promise<"recording" | "denied" | "unsupported"> => {
    const type = aacType();
    if (!type) return "unsupported";
    if (session.current) return "recording";
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      setDenied(true);
      return "denied";
    }
    setDenied(false);
    const recorder = new MediaRecorder(stream, { mimeType: type, audioBitsPerSecond: 64_000 });
    if (/opus|vorbis/i.test(recorder.mimeType)) {
      stream.getTracks().forEach((t) => t.stop());
      return "unsupported";
    }
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    context.createMediaStreamSource(stream).connect(analyser);
    const buffer = new Float32Array(analyser.fftSize);
    const s: Session = { recorder, stream, context, chunks: [], samples: [], startedAt: Date.now(), timer: 0 };
    recorder.ondataavailable = (e) => e.data.size > 0 && s.chunks.push(e.data);
    s.timer = window.setInterval(() => {
      s.samples.push(levelOf(analyser, buffer));
      const elapsed = Date.now() - s.startedAt;
      setDurationMs(elapsed);
      setLive(s.samples.slice(-24));
      if (elapsed >= VOICE_MAX_MS) stop().then((done) => done && limit.current(done));
    }, TICK_MS);
    session.current = s;
    recorder.start();
    setRecording(true);
    return "recording";
  };

  return { supported, recording, denied, durationMs, live, start, stop, cancel };
}
