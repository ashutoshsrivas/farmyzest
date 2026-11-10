import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  role: z.enum(["CUSTOMER", "POS_STAFF", "ADMIN", "RESELLER"]).optional(),
  isActive: z.boolean().optional(),
});

// Change a user's role / active state. ADMIN-only, with guards so an admin can't
// lock themselves (or everyone) out.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { role, isActive } = parsed.data;
  if (role === undefined && isActive === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const target = await db.user.findUnique({ where: { id }, select: { id: true, role: true, isActive: true } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Self-protection: don't let an admin demote or deactivate themselves.
  if (id === session.user.id) {
    if (role && role !== "ADMIN") return NextResponse.json({ error: "You can't change your own admin role." }, { status: 400 });
    if (isActive === false) return NextResponse.json({ error: "You can't deactivate your own account." }, { status: 400 });
  }

  // Last-admin protection: never remove the final active admin.
  const demotingAdmin = target.role === "ADMIN" && ((role && role !== "ADMIN") || isActive === false);
  if (demotingAdmin) {
    const otherAdmins = await db.user.count({ where: { role: "ADMIN", isActive: true, id: { not: id } } });
    if (otherAdmins === 0) {
      return NextResponse.json({ error: "Can't remove the last active admin." }, { status: 400 });
    }
  }

  const user = await db.user.update({
    where: { id },
    data: { ...(role !== undefined ? { role } : {}), ...(isActive !== undefined ? { isActive } : {}) },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });
  return NextResponse.json({ success: true, user });
}
