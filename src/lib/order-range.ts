// Quick-range date windows for the admin Orders view (list + summary + export).
// "today" is the IST calendar day — the store runs on IST, so it must start at
// 00:00 IST, not the server's UTC midnight.

export type QuickRange = "today" | "7d" | "30d" | "all";

export function isQuickRange(v: string | null | undefined): v is QuickRange {
  return v === "today" || v === "7d" || v === "30d" || v === "all";
}

export function quickRangeWindow(r: QuickRange): { gte?: Date; lt?: Date; label: string } {
  const now = new Date();
  if (r === "today") {
    const IST = 5.5 * 60 * 60 * 1000;
    const ist = new Date(now.getTime() + IST);
    ist.setUTCHours(0, 0, 0, 0);
    const start = new Date(ist.getTime() - IST);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { gte: start, lt: end, label: "Today" };
  }
  if (r === "7d") {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    return { gte: start, label: "Last 7 days" };
  }
  if (r === "30d") {
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    return { gte: start, label: "Last 30 days" };
  }
  return { label: "All time" };
}
