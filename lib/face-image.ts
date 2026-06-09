export const FACE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const FACE_JPEG_QUALITY = 0.8;

export function base64DecodedSize(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

/** Strip `data:image/jpeg;base64,` prefix if present. */
export function stripDataUrlPrefix(value: string) {
  const trimmed = value.trim();
  if (!trimmed.includes(",")) return trimmed;
  return trimmed.split(",").pop() ?? trimmed;
}

export function canvasToJpegDataUrl(canvas: HTMLCanvasElement, quality = FACE_JPEG_QUALITY) {
  return canvas.toDataURL("image/jpeg", quality);
}

export function canvasToJpegBase64(canvas: HTMLCanvasElement, quality = FACE_JPEG_QUALITY) {
  return stripDataUrlPrefix(canvasToJpegDataUrl(canvas, quality));
}

/** Compress live capture to JPEG base64, targeting ≤5MB decoded. */
export function compressCanvasToJpegBase64(
  source: HTMLCanvasElement,
  maxBytes = FACE_IMAGE_MAX_BYTES,
): string {
  let quality = FACE_JPEG_QUALITY;
  let scale = 1;

  for (let attempt = 0; attempt < 14; attempt++) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(source.width * scale));
    canvas.height = Math.max(1, Math.floor(source.height * scale));

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not prepare camera image.");

    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    const base64 = canvasToJpegBase64(canvas, quality);

    if (base64DecodedSize(base64) <= maxBytes) return base64;

    if (quality > 0.45) {
      quality = Math.max(0.45, quality - 0.1);
      continue;
    }

    scale *= 0.85;
    quality = FACE_JPEG_QUALITY;
  }

  throw new Error("Could not compress image below 5 MB. Try again with better lighting.");
}

export function normalizeFaceImagePayload(image: string, maxBytes = FACE_IMAGE_MAX_BYTES) {
  const base64 = stripDataUrlPrefix(image);
  if (!base64) throw new Error("Invalid image data.");

  const size = base64DecodedSize(base64);
  if (size > maxBytes) {
    throw new Error("Image must be under 5 MB. Retake your selfie.");
  }

  return base64;
}
