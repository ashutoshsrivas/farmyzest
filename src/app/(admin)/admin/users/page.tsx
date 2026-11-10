export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import AdminPagination from "@/components/admin/Pagination";
import { UsersTable } from "./_components/UsersTable";

const PAGE_SIZE = 30;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; role?: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/login");

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const skip = (page - 1) * PAGE_SIZE;
  const q = params.q?.trim();
  const roleFilter = ["CUSTOMER", "POS_STAFF", "ADMIN", "RESELLER"].includes(params.role ?? "")
    ? (params.role as Prisma.UserWhereInput["role"])
    : undefined;

  const where: Prisma.UserWhereInput = {
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(roleFilter ? { role: roleFilter } : {}),
  };

  // Show staff/admin first (most relevant for access management), then by date.
  const [users, total, staffCount] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip,
      take: PAGE_SIZE,
      select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, createdAt: true },
    }),
    db.user.count({ where }),
    db.user.count({ where: { role: { in: ["ADMIN", "POS_STAFF"] } } }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif text-nate-grey-800">Users & Access</h1>
          <p className="text-sm text-nate-grey-500 mt-1">
            Grant Admin or POS access to specific people. Everyone else stays a customer.
          </p>
        </div>
        <span className="text-sm text-nate-grey-500">{staffCount} staff · {total} users</span>
      </div>

      {/* Filters (URL-driven) */}
      <form className="bg-white rounded-xl p-4 mb-6 flex flex-wrap items-end gap-3" action="/admin/users">
        <div className="flex flex-col gap-1 flex-1 min-w-56">
          <label className="text-[10px] uppercase tracking-wider text-nate-grey-500 font-medium">Search</label>
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Name, email, or phone…"
            className="w-full px-3 py-2 text-sm border border-nate-grey-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider text-nate-grey-500 font-medium">Role</label>
          <select
            name="role"
            defaultValue={params.role ?? ""}
            className="border border-nate-grey-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-nate-grey-400"
          >
            <option value="">All roles</option>
            <option value="ADMIN">Admin</option>
            <option value="POS_STAFF">POS staff</option>
            <option value="RESELLER">Reseller</option>
            <option value="CUSTOMER">Customer</option>
          </select>
        </div>
        <button type="submit" className="px-4 py-2 bg-nate-grey-800 text-white rounded-lg text-sm font-medium hover:bg-nate-grey-700">
          Apply
        </button>
      </form>

      <UsersTable users={users} currentUserId={session.user.id} />
      <AdminPagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} />
    </div>
  );
}
