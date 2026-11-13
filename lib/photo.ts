/** The API stores 512 px; twice that leaves room for its crop without sending a full camera photo. */
const MAX_SIDE = 1024;

/**
 * Shrinks a chosen photo in the browser and re-saves it as JPEG. With `aspect` (width / height) the
 * middle of the photo is cut to that shape first. Throws when the browser cannot read the file, which
 * for most people means it is not a photo.
 */
export async function shrinkPhoto(file: File, maxSide = MAX_SIDE, aspect?: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    let cut = { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
    if (aspect && Math.abs(bitmap.width / bitmap.height - aspect) > 0.01) {
      const width = bitmap.width / bitmap.height > aspect ? Math.round(bitmap.height * aspect) : bitmap.width;
      const height = bitmap.width / bitmap.height > aspect ? bitmap.height : Math.round(bitmap.width / aspect);
      cut = { x: Math.round((bitmap.width - width) / 2), y: Math.round((bitmap.height - height) / 2), width, height };
    }
    const scale = Math.min(1, maxSide / Math.max(cut.width, cut.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(cut.width * scale);
    canvas.height = Math.round(cut.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No canvas");
    context.drawImage(bitmap, cut.x, cut.y, cut.width, cut.height, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not encode"))), "image/jpeg", 0.85),
    );
  } finally {
    bitmap.close();
  }
}
