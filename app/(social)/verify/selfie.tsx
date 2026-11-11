"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Icon } from "@/components/ui";
import styles from "./verify.module.css";

type Stage = "idle" | "starting" | "live" | "taken";

const CAMERA_HELP: Record<string, string> = {
  NotAllowedError: "Camera access is blocked. Allow it for ruxstar.com in your browser settings, then try again.",
  NotFoundError: "We could not find a camera. Use a device with a front camera.",
  NotReadableError: "Another app is using the camera. Close it and try again.",
};

/**
 * A live selfie from the camera. There is no file upload on purpose: the photo must be taken now
 * for the liveness check. The preview is mirrored like a mirror; the photo sent is not.
 */
export function SelfieCapture({ busy, onUse }: { busy: boolean; onUse: (photo: Blob) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stop = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };

  useEffect(() => stop, []);
  useEffect(
    () => () => {
      if (photo) URL.revokeObjectURL(photo.url);
    },
    [photo],
  );

  async function start() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser cannot open the camera. Try Chrome, Safari or Edge.");
      return;
    }
    setStage("starting");
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      setPhoto(null);
      setStage("live");
    } catch (err) {
      setError(CAMERA_HELP[(err as DOMException).name] ?? "We could not open the camera. Try again.");
      setStage("idle");
    }
  }

  useEffect(() => {
    if (stage === "live" && video.current && stream.current) {
      video.current.srcObject = stream.current;
      void video.current.play().catch(() => undefined);
    }
  }, [stage]);

  function take() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")!.drawImage(v, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return setError("We could not take the photo. Try again.");
        stop();
        setPhoto({ blob, url: URL.createObjectURL(blob) });
        setStage("taken");
      },
      "image/jpeg",
      0.9,
    );
  }

  return (
    <div className={styles.selfie}>
      {stage === "live" || stage === "starting" ? (
        <div className={styles.viewfinder}>
          <video ref={video} className={styles.video} playsInline muted aria-label="Camera preview" />
          <span className={styles.oval} aria-hidden />
        </div>
      ) : photo ? (
        <div className={styles.viewfinder}>
          <img src={photo.url} alt="Your selfie" className={styles.shot} />
        </div>
      ) : null}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.actions}>
        {stage === "idle" && (
          <Button icon={<Icon name="camera" size={20} />} onClick={start}>
            Open camera
          </Button>
        )}
        {stage === "starting" && <Button loading>Opening camera</Button>}
        {stage === "live" && (
          <>
            <Button variant="ghost" onClick={() => (stop(), setStage("idle"))}>
              Cancel
            </Button>
            <Button icon={<Icon name="camera" size={20} />} onClick={take}>
              Take photo
            </Button>
          </>
        )}
        {stage === "taken" && photo && (
          <>
            <Button variant="ghost" onClick={start} disabled={busy}>
              Retake
            </Button>
            <Button loading={busy} onClick={() => onUse(photo.blob)}>
              Use this photo
            </Button>
          </>
        )}
      </div>
      <p className={styles.hint}>Face the camera in good light, without glasses or a cap. Your selfie is checked and then deleted.</p>
    </div>
  );
}
