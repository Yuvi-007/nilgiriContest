import type { LeaderRow } from "@/lib/queries";
import { mmss } from "@/lib/time";
import { cn } from "@/lib/utils";

export function LeaderboardTable({ rows, highlight }: { rows: LeaderRow[]; highlight?: string }) {
  if (rows.length === 0) return <p className="text-muted-foreground">No results yet.</p>;
  return (
    <div className="glass overflow-x-auto rounded-2xl">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-muted-foreground">
          <tr className="border-b border-border">
            <th className="p-3">Rank</th>
            <th className="p-3">Student</th>
            <th className="p-3 text-right">Score</th>
            <th className="p-3 text-right">Time</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={r.userId}
              className={cn(
                "border-b border-border/50 last:border-0",
                r.userId === highlight && "bg-primary/10",
              )}
            >
              <td
                className={cn(
                  "p-3 font-mono font-bold",
                  i === 0 && "text-gold",
                  i === 1 && "text-cyan",
                  i === 2 && "text-orange",
                )}
              >
                #{i + 1}
              </td>
              <td className="p-3">
                <div className="font-medium">{r.name}</div>
                <div className="font-mono text-xs text-muted-foreground">{r.loginId}</div>
              </td>
              <td className="p-3 text-right font-mono">
                {r.score.toFixed(2)}{" "}
                <span className="text-muted-foreground">/ {20 * r.contests}</span>
              </td>
              <td className="p-3 text-right font-mono text-muted-foreground">{mmss(r.time)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
