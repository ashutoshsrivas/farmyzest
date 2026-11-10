// Client-side video upload for homepage reels. Unlike images we don't
// transcode in the browser — we push the file straight to S3 via a presigned
// URL and store the public URL. Keep clips short/vertical for autoplay.

const MAX_BYTES = 60 * 1024 * 1024; // 60 MB — plenty for a short reel.

export async function uploadVideo(file: File, prefix = "home"): Promise<string> {
  if (!file.type.startsWith("video/")) {
    throw new Error("Please choose a video file.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Video is too large (max 60 MB). Trim or compress it first.");
  }

  const ext = (file.name.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "") || "mp4";
  const safePrefix = prefix.replace(/[^a-z0-9-]/gi, "-").toLowerCase() || "home";
  const rand = Math.random().toString(36).slice(2, 8);
  const key = `videos/${safePrefix}-${Date.now()}-${rand}.${ext}`;
  const contentType = file.type || "video/mp4";

  const presignRes = await fetch(
    `/api/upload/presign?key=${encodeURIComponent(key)}&type=${encodeURIComponent(contentType)}`
  );
  if (!presignRes.ok) throw new Error("Could not get upload URL");
  const { uploadUrl, publicUrl } = await presignRes.json();

  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!put.ok) throw new Error(`Upload failed (${put.status})`);

  return publicUrl as string;
}
