// Client-side product image upload: downscale to ≤1080px on the long edge,
// re-encode as WebP, then push straight to S3 via a presigned URL. Returns the
// public URL to store on the product. Runs in the browser only.

/** Resize (longest side ≤ maxDim) and re-encode an image File as WebP. */
export async function compressToWebp(
  file: File,
  maxDim = 1080,
  quality = 0.82
): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    bitmap = await createImageBitmap(file);
  }

  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", quality)
  );
  if (!blob) throw new Error("Could not encode WebP");
  return blob;
}

/**
 * Compress a product image and upload it to S3. `prefix` (usually the product
 * slug) keeps keys tidy. Returns the public URL.
 */
export async function uploadProductImage(
  file: File,
  prefix = "products"
): Promise<string> {
  const blob = await compressToWebp(file);
  const safePrefix = prefix.replace(/[^a-z0-9-]/gi, "-").toLowerCase() || "products";
  const rand = Math.random().toString(36).slice(2, 8);
  const key = `products/${safePrefix}-${Date.now()}-${rand}.webp`;

  const presignRes = await fetch(
    `/api/upload/presign?key=${encodeURIComponent(key)}&type=image/webp`
  );
  if (!presignRes.ok) throw new Error("Could not get upload URL");
  const { uploadUrl, publicUrl } = await presignRes.json();

  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/webp" },
    body: blob,
  });
  if (!put.ok) throw new Error(`Upload failed (${put.status})`);

  return publicUrl as string;
}
