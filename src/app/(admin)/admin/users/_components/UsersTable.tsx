"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

type Role = "CUSTOMER" | "POS_STAFF" | "ADMIN" | "RESELLER";

interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
  createdAt: Date | string;
}

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  POS_STAFF: "POS staff",
  RESELLER: "Reseller",
  CUSTOMER: "Customer",
};

const ROLE_TONE: Record<Role, string> = {
  ADMIN: "bg-purple-100 text-purple-700",
  POS_STAFF: "bg-blue-100 text-blue-700",
  RESELLER: "bg-amber-100 text-amber-700",
  CUSTOMER: "bg-nate-grey-100 text-nate-grey-600",
};

export function UsersTable({ users, currentUserId }: { users: User[]; currentUserId: string }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  // Optimistic local overrides.
  const [roles, setRoles] = useState<Record<string, Role>>({});
  const [actives, setActives] = useState<Record<string, boolean>>({});

  const roleOf = (u: User) => roles[u.id] ?? u.role;
  const activeOf = (u: User) => actives[u.id] ?? u.isActive;

  async function patch(id: string, body: { role?: Role; isActive?: boolean }) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Update failed");
        return false;
      }
      toast.success("Saved");
      router.refresh();
      return true;
    } catch {
      toast.error("Network error");
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function changeRole(u: User, role: Role) {
    const prev = roleOf(u);
    setRoles((m) => ({ ...m, [u.id]: role }));
    const ok = await patch(u.id, { role });
    if (!ok) setRoles((m) => ({ ...m, [u.id]: prev })); // revert
  }

  async function toggleActive(u: User) {
    const next = !activeOf(u);
    setActives((m) => ({ ...m, [u.id]: next }));
    const ok = await patch(u.id, { isActive: next });
    if (!ok) setActives((m) => ({ ...m, [u.id]: !next }));
  }

  return (
    <div className="bg-white rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-nate-grey-100 bg-nate-grey-50">
              <th className="text-left px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">User</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">Phone</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">Access (role)</th>
              <th className="text-center px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-nate-grey-100">
            {users.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-nate-grey-500">No users match.</td>
              </tr>
            ) : (
              users.map((u) => {
                const self = u.id === currentUserId;
                const role = roleOf(u);
                const active = activeOf(u);
                return (
                  <tr key={u.id} className="hover:bg-nate-grey-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ROLE_TONE[role]}`}>
                          {ROLE_LABEL[role]}
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium text-nate-grey-800 truncate">{u.name || "—"}{self ? " (you)" : ""}</p>
                          <p className="text-xs text-nate-grey-400 truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-nate-grey-600">{u.phone || "—"}</td>
                    <td className="px-6 py-4">
                      <select
                        value={role}
                        disabled={busyId === u.id || (self && role === "ADMIN")}
                        onChange={(e) => changeRole(u, e.target.value as Role)}
                        className="border border-nate-grey-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-nate-grey-400 disabled:opacity-60"
                        title={self ? "You can't change your own admin role" : "Set this user's access"}
                      >
                        <option value="CUSTOMER">Customer (no access)</option>
                        <option value="POS_STAFF">POS staff (POS only)</option>
                        <option value="ADMIN">Admin (full access)</option>
                        <option value="RESELLER">Reseller</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => toggleActive(u)}
                        disabled={busyId === u.id || self}
                        className={`inline-flex items-center w-10 h-5 rounded-full px-0.5 transition-colors disabled:opacity-50 ${
                          active ? "bg-green-500 justify-end" : "bg-nate-grey-300 justify-start"
                        }`}
                        title={self ? "You can't deactivate yourself" : active ? "Active — click to disable sign-in" : "Disabled — click to enable"}
                      >
                        <span className="w-4 h-4 rounded-full bg-white shadow" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
