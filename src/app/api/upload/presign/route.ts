import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPresignedUploadUrl, getPublicUrl } from "@/lib/s3";

/**
 * GET /api/upload/presign?key=categories/tops.jpg&type=image/jpeg
 * Returns { uploadUrl, publicUrl } for direct browser → S3 upload.
 * Admin-only.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const key = searchParams.get("key");
  const contentType = searchParams.get("type") || "image/jpeg";

  if (!key) return NextResponse.json({ error: "key is required" }, { status: 400 });

  // Sanitize key — strip any leading slash, allow only safe chars
  const safeKey = key.replace(/^\/+/, "").replace(/[^a-zA-Z0-9._\-\/]/g, "-");

  const uploadUrl = await getPresignedUploadUrl({ key: safeKey, contentType });
  const publicUrl = getPublicUrl(safeKey);

  return NextResponse.json({ uploadUrl, publicUrl });
}
