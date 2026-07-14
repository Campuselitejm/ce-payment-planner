// Downscale + re-encode an image before upload.
// Returns a File. Falls back to the original if anything goes wrong.
export async function compressImage(file, {
  maxDim = 1600,
  quality = 0.7,
  maxBytes = 400 * 1024,
} = {}) {
  try {
    if (!file || !file.type?.startsWith("image/")) return file; // PDFs pass through
    if (file.size <= maxBytes) return file;

    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;

    if (width > maxDim || height > maxDim) {
      const scale = maxDim / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    let q = quality;
    let blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", q));
    while (blob && blob.size > maxBytes && q > 0.4) {
      q -= 0.1;
      blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", q));
    }

    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file; // never block a submit because compression failed
  }
}
