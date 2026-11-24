import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { homeContentSchema } from "@/lib/home-content";
import { getHomeContent, HOME_CONTENT_ID } from "@/lib/home-content-server";

// Admin: read and save the homepage content (all sections at once).

async function requireAdmin() {
  const session = await auth();
  return !!session?.user && session.user.role === "ADMIN";
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ content: await getHomeContent() });
}

export async function PUT(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = homeContentSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path?.join(" › ");
    return NextResponse.json({ error: `${where ? `${where}: ` : ""}${issue?.message ?? "Invalid content"}` }, { status: 400 });
  }
  const data = parsed.data as unknown as Prisma.InputJsonValue;
  await db.storeSetting.upsert({
    where: { id: HOME_CONTENT_ID },
    update: { data },
    create: { id: HOME_CONTENT_ID, data },
  });
  return NextResponse.json({ content: parsed.data });
}

/** Restore everything to the built-in defaults. */
export async function DELETE() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await db.storeSetting.deleteMany({ where: { id: HOME_CONTENT_ID } });
  return NextResponse.json({ content: await getHomeContent() });
}
