"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  canvasToJpegDataUrl,
  compressCanvasToJpegBase64,
  FACE_IMAGE_MAX_BYTES,
  FACE_JPEG_QUALITY,
} from "@/lib/face-image";

type Props = {
  disabled?: boolean;
  onCapture: (base64Jpeg: string) => Promise<void>;
};

export function FaceCapture({ disabled, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [captureError, setCaptureError] = useState("");
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

    setCaptureError("");

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    captureCanvasRef.current = canvas;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setCaptureError("Could not capture from camera.");
      return;
    }

    ctx.drawImage(video, 0, 0, width, height);

    try {
      const previewUrl = canvasToJpegDataUrl(canvas, FACE_JPEG_QUALITY);
      stopCamera();
      setPreview(previewUrl);
    } catch {
      setCaptureError("Could not capture JPEG from camera.");
    }
  }

  function retake() {
    setPreview(null);
    setCaptureError("");
    setCameraError("");
    captureCanvasRef.current = null;
  }

  async function submit() {
    if (!preview && !captureCanvasRef.current) return;

    setCaptureError("");
    setSubmitting(true);

    try {
      let base64: string;

      if (captureCanvasRef.current) {
        base64 = compressCanvasToJpegBase64(captureCanvasRef.current, FACE_IMAGE_MAX_BYTES);
      } else {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("Could not read captured preview."));
          img.src = preview!;
        });

        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not prepare captured image.");
        ctx.drawImage(img, 0, 0);
        base64 = compressCanvasToJpegBase64(canvas, FACE_IMAGE_MAX_BYTES);
      }

      await onCapture(base64);
      setPreview(null);
      captureCanvasRef.current = null;
    } catch (err) {
      setCaptureError(err instanceof Error ? err.message : "Could not submit selfie.");
    } finally {
      setSubmitting(false);
    }
  }

  const busy = disabled || submitting;

  return (
    <div className="space-y-4">
      {(cameraError || captureError) && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {cameraError || captureError}
        </p>
      )}

      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/50">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Captured selfie preview" className="aspect-[4/3] w-full object-cover" />
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="aspect-[4/3] w-full scale-x-[-1] object-cover"
            />
            {cameraReady && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-[55%] w-[42%] rounded-[50%] border-2 border-dashed border-white/35 shadow-[inset_0_0_40px_rgba(0,0,0,0.3)]" />
              </div>
            )}
          </>
        )}

        {!preview && !cameraReady && !cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 text-sm text-zinc-400">
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
            Starting camera…
          </div>
        )}
      </div>

      <p className="text-center text-xs text-zinc-600">
        Align your face inside the oval · good lighting helps
      </p>

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
              {submitting ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Verifying…
                </span>
              ) : (
                "Submit selfie"
              )}
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={busy || !cameraReady}
            onClick={takePhoto}
            className="btn-primary w-full rounded-full py-3.5 text-sm font-semibold disabled:opacity-60"
          >
            Capture photo
          </button>
        )}
      </div>
    </div>
  );
}
