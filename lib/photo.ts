/** The API stores 512 px; twice that leaves room for its crop without sending a full camera photo. */
const MAX_SIDE = 1024;

/**
 * Shrinks a chosen photo in the browser and re-saves it as JPEG. Throws when the browser cannot
 * read the file, which for most people means it is not a photo.
 */
export async function shrinkPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No canvas");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not encode"))), "image/jpeg", 0.85),
    );
  } finally {
    bitmap.close();
  }
}
