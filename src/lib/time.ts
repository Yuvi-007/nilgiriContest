// All timestamps are stored in UTC; everything is displayed in Asia/Kolkata (IST).
export const IST = "Asia/Kolkata";

export function formatIST(iso: string | Date, opts: Intl.DateTimeFormatOptions = {}) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return (
    new Intl.DateTimeFormat("en-IN", {
      timeZone: IST,
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      ...opts,
    }).format(d) + " IST"
  );
}

export type ContestStatus = "draft" | "scheduled" | "live" | "closed";

/** Status is derived from the time window; only `draft` is stored. */
export function contestStatus(
  c: { is_draft: boolean; start_time: string; end_time: string },
  now = Date.now(),
): ContestStatus {
  if (c.is_draft) return "draft";
  if (now < new Date(c.start_time).getTime()) return "scheduled";
  if (now < new Date(c.end_time).getTime()) return "live";
  return "closed";
}

export function hms(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
}

export function mmss(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}
