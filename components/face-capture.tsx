"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  disabled?: boolean;
  onCapture: (base64Jpeg: string) => Promise<void>;
};

export function FaceCapture({ disabled, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError("");
    stopCamera();

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
        setCameraReady(true);
      }
    } catch {
      setCameraError("Could not access camera. Allow camera permission and try again.");
    }
  }, [stopCamera]);

  useEffect(() => {
    if (!preview) {
      startCamera();
    }
    return () => stopCamera();
  }, [preview, startCamera, stopCamera]);

  function takePhoto() {
    const video = videoRef.current;
    if (!video || !cameraReady) return;

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    stopCamera();
    setPreview(dataUrl);
  }

  function retake() {
    setPreview(null);
    setCameraError("");
  }

  async function submit() {
    if (!preview) return;

    const base64 = preview.includes(",") ? preview.split(",")[1] : preview;
    setSubmitting(true);
    try {
      await onCapture(base64);
      setPreview(null);
    } finally {
      setSubmitting(false);
    }
  }

  const busy = disabled || submitting;

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-400">
        Take a live selfie with your camera. We&apos;ll match it against your Aadhaar photo from
        DigiLocker.
      </p>

      {cameraError && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {cameraError}
        </p>
      )}

      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/40">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Captured selfie preview" className="aspect-[4/3] w-full object-cover" />
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            className="aspect-[4/3] w-full scale-x-[-1] object-cover"
          />
        )}

        {!preview && !cameraReady && !cameraError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm text-zinc-400">
            Starting camera…
          </div>
        )}
      </div>

      <div className="flex gap-3">
        {preview ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={retake}
              className="flex-1 rounded-full border border-white/10 py-3 text-sm transition hover:bg-white/5 disabled:opacity-60"
            >
              Retake
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={submit}
              className="btn-primary flex-1 rounded-full py-3 text-sm font-semibold disabled:opacity-60"
            >
              {submitting ? "Verifying…" : "Submit selfie"}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={busy || !cameraReady}
              onClick={startCamera}
              className="flex-1 rounded-full border border-white/10 py-3 text-sm transition hover:bg-white/5 disabled:opacity-60"
            >
              Restart camera
            </button>
            <button
              type="button"
              disabled={busy || !cameraReady}
              onClick={takePhoto}
              className="btn-primary flex-1 rounded-full py-3 text-sm font-semibold disabled:opacity-60"
            >
              Capture photo
            </button>
          </>
        )}
      </div>
    </div>
  );
}
