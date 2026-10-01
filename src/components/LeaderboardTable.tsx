import React, { useEffect, useRef, useState } from "react";
import type { LeaderRow } from "@/lib/queries";
import { mmss } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Trophy, Clock, Hash, Medal } from "lucide-react";

/* ── Animated count-up number ── */
function CountUp({ value, duration = 900, decimals = 0 }: { value: number; duration?: number; decimals?: number }) {
  const [display, setDisplay] = useState(0);
  const raf = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    const from = 0;
    const to = value;
    const step = (ts: number) => {
      const pct = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - pct, 3); // ease-out cubic
      setDisplay(from + (to - from) * eased);
      if (pct < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [value, duration]);

  return <>{display.toFixed(decimals)}</>;
}

/* ── Avatar circle ── */
function Avatar({ name, rank, size = "md" }: { name: string; rank: number; size?: "sm" | "md" | "lg" }) {
  const initials = name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  const colors = [
    "from-gold to-orange",      // #1
    "from-cyan to-violet",      // #2
    "from-orange to-destructive", // #3
    "from-violet to-primary",   // rest
  ];
  const color = colors[Math.min(rank - 1, colors.length - 1)];
  const sz = size === "lg" ? "h-16 w-16 text-2xl" : size === "md" ? "h-12 w-12 text-lg" : "h-8 w-8 text-xs";
  return (
    <div className={cn("shrink-0 rounded-full bg-gradient-to-br flex items-center justify-center font-bold text-white shadow-lg", sz, color)}>
      {initials}
    </div>
  );
}

/* ── Rank badge / medal ── */
const MEDALS = ["🥇", "🥈", "🥉"];
function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    return (
      <span className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold",
        rank === 1 && "bg-gold/20 text-gold ring-1 ring-gold/40",
        rank === 2 && "bg-cyan/20 text-cyan ring-1 ring-cyan/40",
        rank === 3 && "bg-orange/20 text-orange ring-1 ring-orange/40",
      )}>
        {MEDALS[rank - 1]}
      </span>
    );
  }
  return <span className="font-mono text-sm text-muted-foreground">#{rank}</span>;
}

/* ── Progress bar (score %) ── */
function ScoreBar({ score, max, color }: { score: number; max: number; color: string }) {
  const pct = Math.round((score / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-border">
        <div
          className={cn("h-full rounded-full transition-all duration-1000", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-right font-mono text-xs text-muted-foreground">{pct}%</span>
    </div>
  );
}

/* ── Podium card (top 3) ── */
function PodiumCard({ row, rank, highlight }: { row: LeaderRow; rank: number; highlight?: string | undefined }) {
  const isMe = row.userId === highlight;
  const maxScore = 20 * row.contests;
  const pct = maxScore > 0 ? Math.round((row.score / maxScore) * 100) : 0;

  const config = {
    1: { medal: "🥇", color: "text-gold", border: "border-gold/30", bg: "bg-gold/5", glow: "shadow-[0_0_30px_rgba(245,158,11,0.15)]", height: "pb-10", order: "order-2" },
    2: { medal: "🥈", color: "text-cyan", border: "border-cyan/30", bg: "bg-cyan/5", glow: "shadow-[0_0_20px_rgba(34,201,245,0.1)]", height: "pb-0 mt-8", order: "order-1" },
    3: { medal: "🥉", color: "text-orange", border: "border-orange/30", bg: "bg-orange/5", glow: "shadow-[0_0_20px_rgba(249,115,22,0.1)]", height: "pb-0 mt-8", order: "order-3" },
  }[rank]!;

  return (
    <div className={cn("flex flex-col items-center gap-3 rounded-2xl border p-5 transition-all duration-300 hover:-translate-y-1", config.border, config.bg, config.glow, config.height, config.order, isMe && "ring-2 ring-primary")}>
      <div className="text-2xl">{config.medal}</div>
      <Avatar name={row.name} rank={rank} size="lg" />
      <div className="text-center">
        <p className="max-w-[120px] truncate text-sm font-bold">{row.name}</p>
        <p className="font-mono text-xs text-muted-foreground">{row.loginId}</p>
      </div>
      <div className={cn("font-mono text-3xl font-extrabold", config.color)}>
        <CountUp value={pct} duration={1200} />%
      </div>
      <div className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Trophy className="h-3 w-3" />
          <CountUp value={row.score} duration={1000} decimals={1} /> / {maxScore} pts
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {mmss(row.time)}
        </span>
      </div>
      <div className={cn(
        "mt-1 w-full rounded-xl py-2 text-center font-mono text-xl font-black",
        rank === 1 && "bg-gold/15 text-gold",
        rank === 2 && "bg-cyan/15 text-cyan",
        rank === 3 && "bg-orange/15 text-orange",
      )}>
        #{rank}
      </div>
    </div>
  );
}

/* ── Main table row ── */
function TableRow({ row, rank, highlight, animDelay }: { row: LeaderRow; rank: number; highlight?: string | undefined; animDelay: number }) {
  const isMe = row.userId === highlight;
  const maxScore = 20 * row.contests;
  const pct = maxScore > 0 ? Math.round((row.score / maxScore) * 100) : 0;
  const barColor =
    rank === 1 ? "bg-gold" :
    rank === 2 ? "bg-cyan" :
    rank === 3 ? "bg-orange" :
    "bg-primary";

  return (
    <tr
      className={cn(
        "group border-b border-border/50 last:border-0 transition-all duration-200 hover:bg-accent/40",
        isMe && "bg-primary/8",
      )}
      style={{ animationDelay: `${animDelay}ms` }}
    >
      <td className="w-12 p-3 pl-4">
        <RankBadge rank={rank} />
      </td>
      <td className="p-3">
        <div className="flex items-center gap-3">
          <Avatar name={row.name} rank={rank} size="sm" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{row.name}</span>
              {isMe && (
                <span className="rounded-full bg-primary/20 px-1.5 py-0.5 font-mono text-[10px] text-primary">you</span>
              )}
            </div>
            <div className="font-mono text-xs text-muted-foreground">{row.loginId}</div>
          </div>
        </div>
      </td>
      <td className="p-3">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-sm font-bold">
            <CountUp value={row.score} duration={800 + animDelay} decimals={1} />
            <span className="text-muted-foreground"> / {maxScore}</span>
          </span>
          <ScoreBar score={row.score} max={maxScore || 1} color={barColor} />
        </div>
      </td>
      <td className="hidden p-3 text-right md:table-cell">
        <span className="font-mono text-sm text-muted-foreground">{mmss(row.time)}</span>
      </td>
      <td className="hidden p-3 text-center lg:table-cell">
        <span className="font-mono text-xs text-muted-foreground">{row.contests}</span>
      </td>
      <td className="p-3 text-right">
        <span className={cn(
          "font-mono text-sm font-bold",
          pct >= 80 ? "text-green" : pct >= 60 ? "text-cyan" : pct >= 40 ? "text-gold" : "text-muted-foreground",
        )}>
          {pct}%
        </span>
      </td>
    </tr>
  );
}

/* ── Main export ── */
export function LeaderboardTable({ rows, highlight }: { rows: LeaderRow[]; highlight?: string }) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <Medal className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-muted-foreground">No results yet. Check back after a contest closes.</p>
      </div>
    );
  }

  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);

  return (
    <div className="space-y-8">
      {/* Podium */}
      {top3.length >= 2 && (
        <div className="flex items-end justify-center gap-4 sm:gap-6">
          {/* Reorder: 2nd, 1st, 3rd */}
          {top3.map((row, i) => (
            <PodiumCard key={row.userId} row={row} rank={i + 1} highlight={highlight} />
          ))}
        </div>
      )}

      {/* Full table */}
      <div className="glass overflow-x-auto rounded-2xl">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr className="border-b border-border">
              <th className="p-3 pl-4"><Hash className="inline h-3 w-3" /></th>
              <th className="p-3">Student</th>
              <th className="p-3"><Trophy className="inline h-3 w-3 mr-1" />Score</th>
              <th className="hidden p-3 text-right md:table-cell"><Clock className="inline h-3 w-3 mr-1" />Time</th>
              <th className="hidden p-3 text-center lg:table-cell">Contests</th>
              <th className="p-3 text-right">%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <TableRow
                key={row.userId}
                row={row}
                rank={i + 1}
                highlight={highlight}
                animDelay={i * 60}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
