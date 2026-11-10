export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Mail } from "lucide-react";

// Minimal viewer: lists messages newest-first, unread (isHandled=false) at the
// top. Admin can mark handled via a server action — for now read-only is
// enough; the toggle can come later when an inbox is actually being used.

export default async function ContactMessagesPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/login");

  const messages = await db.contactMessage.findMany({
    orderBy: [{ isHandled: "asc" }, { createdAt: "desc" }],
    take: 200,
  });

  const unreadCount = messages.filter((m) => !m.isHandled).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif text-nate-grey-800">Contact Messages</h1>
          <p className="text-sm text-nate-grey-500 mt-1">
            {messages.length} total · {unreadCount} new
          </p>
        </div>
      </div>

      {messages.length === 0 ? (
        <div className="bg-white rounded-xl p-16 text-center">
          <div className="w-12 h-12 rounded-full bg-nate-grey-100 flex items-center justify-center mx-auto mb-4">
            <Mail className="w-6 h-6 text-nate-grey-400" />
          </div>
          <p className="text-sm text-nate-grey-500">No contact messages yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-nate-grey-50 border-b border-nate-grey-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">From</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">Message</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">Received</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-nate-grey-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nate-grey-100">
              {messages.map((m) => (
                <tr key={m.id} className={m.isHandled ? "opacity-60" : ""}>
                  <td className="px-6 py-4 align-top">
                    <p className="text-sm font-medium text-nate-grey-800">{m.name}</p>
                    <a
                      href={`mailto:${m.email}`}
                      className="text-xs text-nate-grey-500 hover:text-accent transition-colors block"
                    >
                      {m.email}
                    </a>
                    {m.phone && (
                      <a
                        href={`tel:${m.phone}`}
                        className="text-xs text-nate-grey-400 hover:text-accent transition-colors block"
                      >
                        {m.phone}
                      </a>
                    )}
                  </td>
                  <td className="px-6 py-4 align-top max-w-md">
                    <p className="text-sm text-nate-grey-700 whitespace-pre-wrap line-clamp-4">
                      {m.message}
                    </p>
                  </td>
                  <td className="px-6 py-4 align-top text-xs text-nate-grey-500 whitespace-nowrap">
                    {new Date(m.createdAt).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-6 py-4 align-top">
                    <span
                      className={
                        m.isHandled
                          ? "text-xs px-2 py-1 rounded-full bg-nate-grey-100 text-nate-grey-600"
                          : "text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700"
                      }
                    >
                      {m.isHandled ? "Handled" : "New"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
