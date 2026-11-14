"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Icon } from "@/components/ui";
import order from "@/components/shop/order.module.css";
import styles from "./events.module.css";

/** The browser's built-in QR reader (Chrome on Android, Edge, Safari 17+). Not in TypeScript's DOM types yet. */
interface Detector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
type DetectorClass = { new (options: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> };

const detectorClass = () => (typeof window === "undefined" ? undefined : (window as unknown as { BarcodeDetector?: DetectorClass }).BarcodeDetector);

/** How often a video frame is checked for a QR code. */
const READ_MS = 250;

/**
 * Point the camera at a ticket. Uses the browser's own QR reader, so nothing extra is downloaded; browsers without
 * one show nothing here and the gate works by typing the code or phone instead. `paused` stops reading while a
 * result or the lookup is up.
 */
export function GateCamera({ onRead, paused }: { onRead: (data: string) => void; paused: boolean }) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [on, setOn] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const read = useRef(onRead);
  const hold = useRef(paused);
  read.current = onRead;
  hold.current = paused;

  useEffect(() => {
    const Kind = detectorClass();
    if (!Kind || !navigator.mediaDevices?.getUserMedia) {
      setSupported(false);
      return;
    }
    if (!Kind.getSupportedFormats) {
      setSupported(true);
      return;
    }
    Kind.getSupportedFormats().then(
      (formats) => setSupported(formats.includes("qr_code")),
      () => setSupported(false),
    );
  }, []);

  useEffect(() => {
    const Kind = detectorClass();
    if (!on || !Kind) return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let live = true;
    const detector = new Kind({ formats: ["qr_code"] });

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then(async (s) => {
        if (!live) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        const el = video.current;
        if (!el) return;
        el.srcObject = s;
        await el.play();
        let reading = false;
        timer = setInterval(() => {
          if (reading || hold.current || el.readyState < 2) return;
          reading = true;
          detector
            .detect(el)
            .then((codes) => {
              const value = codes[0]?.rawValue;
              if (value && live) read.current(value);
            })
            .catch(() => undefined)
            .finally(() => {
              reading = false;
            });
        }, READ_MS);
      })
      .catch((err: unknown) => {
        if (!live) return;
        setOn(false);
        setProblem(
          err instanceof DOMException && err.name === "NotAllowedError"
            ? "The camera is blocked for this site. Allow it in the browser’s settings, or type codes below."
            : "Couldn’t start the camera. Type codes below instead.",
        );
      });

    return () => {
      live = false;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [on]);

  if (supported === false) {
    return <p className={order.faint}>This browser can’t read QR codes. Type the code or phone below, or use the Ruxstar app to scan.</p>;
  }
  if (!on) {
    return (
      <div className={order.actions}>
        <Button
          size="lg"
          icon={<Icon name="camera" size={18} />}
          disabled={supported === null}
          onClick={() => {
            setProblem(null);
            setOn(true);
          }}
        >
          Scan with the camera
        </Button>
        {problem && (
          <p className={order.error} role="alert">
            {problem}
          </p>
        )}
      </div>
    );
  }
  return (
    <div className={styles.cameraBox}>
      <div className={styles.camera}>
        <video ref={video} muted playsInline aria-label="Camera view for scanning tickets" />
      </div>
      <div>
        <Button variant="ghost" onClick={() => setOn(false)}>
          Stop the camera
        </Button>
      </div>
    </div>
  );
}
