import React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Page, PageHeader, GlassCard } from "@/components/ui-kit";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ContestCard } from "@/components/ContestCard";
import { contestsQuery, dashboardHistoryQuery, leaderboardQuery } from "@/lib/queries";
import { contestStatus } from "@/lib/time";
import { Trophy, Star, Zap, TrendingUp, ArrowRight, Medal } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_student/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — nilgiriContest" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { authInfo } = Route.useRouteContext();
  const { data: contests = [] } = useQuery(contestsQuery);
  const { data: board = [] } = useQuery(leaderboardQuery());
  const { data: history = [], isLoading: historyLoading } = useQuery(
    dashboardHistoryQuery(authInfo.userId),
  );
  const rank = board.findIndex((r) => r.userId === authInfo.userId);
  const me = board[rank];
  const active = contests.filter((c) => contestStatus(c) !== "closed");

  const firstName = authInfo.fullName.split(" ")[0];
  const initials = authInfo.fullName
    .split(" ")
    .map((n: string) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const statCards: {
    label: string;
    value: number | string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bg: string;
    border: string;
    gradient?: boolean;
    subtext: string;
  }[] = [
    {
      label: "Overall rank",
      value: me ? `#${rank + 1}` : "—",
      icon: Trophy,
      color: "text-gold",
      bg: "bg-gold/10",
      border: "border-gold/20",
      subtext: me ? `out of ${board.length} students` : "Complete a contest to rank",
    },
    {
      label: "Total score",
      value: me ? me.score.toFixed(1) : "0",
      icon: Star,
      color: "text-cyan",
      bg: "bg-cyan/10",
      border: "border-cyan/20",
      gradient: true,
      subtext: "cumulative marks",
    },
    {
      label: "Contests taken",
      value: me?.contests ?? 0,
      icon: Zap,
      color: "text-violet",
      bg: "bg-violet/10",
      border: "border-violet/20",
      subtext: active.length > 0 ? `${active.length} active now` : "none active",
    },
  ];

  return (
    <Page>
      {/* Welcome banner */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-violet/20 bg-gradient-to-r from-violet/8 via-transparent to-cyan/8 p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-primary text-xl font-bold text-white shadow-glow">
            {initials}
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Hi, <span className="text-gradient">{firstName}</span> 👋
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {authInfo.fullName} · Student
            </p>
          </div>
        </div>
        <Link
          to="/contests"
          className="flex items-center gap-2 rounded-xl border border-violet/30 bg-violet/10 px-4 py-2 text-sm font-medium text-violet transition-all hover:bg-violet/20 hover:shadow-lg"
        >
          View all contests <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Stat cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {statCards.map(({ label, value, icon: Icon, color, bg, border, gradient, subtext }) => (
          <div
            key={label}
            className={`glass rounded-2xl border p-5 transition-all duration-200 hover:-translate-y-0.5 ${border}`}
          >
            <div className="flex items-start justify-between">
              <div className={`rounded-xl ${bg} p-2.5`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-xs text-muted-foreground">{label}</div>
              <div
                className={`mt-1 font-mono text-3xl font-bold ${gradient ? "text-gradient" : color}`}
              >
                {value}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{subtext}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Performance history */}
      <section className="mb-10" aria-labelledby="performance-heading">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 id="performance-heading" className="flex items-center gap-2 text-lg font-bold">
              <TrendingUp className="h-5 w-5 text-violet" />
              Performance history
            </h2>
            <p className="text-sm text-muted-foreground">Closed ranked contests only.</p>
          </div>
        </div>
        {historyLoading ? (
          <GlassCard>
            <div className="flex items-center gap-3">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet border-t-transparent" />
              <p className="text-sm text-muted-foreground">Loading performance history…</p>
            </div>
          </GlassCard>
        ) : history.length === 0 ? (
          <GlassCard className="text-center py-10">
            <Medal className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="font-semibold text-muted-foreground">No contest history yet</p>
            <p className="mt-1 text-sm text-muted-foreground/70">
              Complete a ranked contest to unlock score, rank, and time trends.
            </p>
          </GlassCard>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            <ChartCard
              title="Score / 20"
              config={{ score: { label: "Score", color: "#22c9f5" } }}
              data={history}
              dataKey="score"
              yLabel="Marks"
            />
            <ChartCard
              title="Rank"
              config={{ rank: { label: "Rank", color: "#f59e0b" } }}
              data={history}
              dataKey="rank"
              yLabel="Position"
              reverse
            />
            <ChartCard
              title="Completion time"
              config={{ timeMinutes: { label: "Minutes", color: "#10b981" } }}
              data={history}
              dataKey="timeMinutes"
              yLabel="Minutes"
            />
          </div>
        )}
      </section>

      {/* Active contests */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Zap className="h-5 w-5 text-gold" />
          Live &amp; upcoming
        </h2>
        <Link to="/contests" className="text-sm text-violet hover:underline">
          All contests →
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {active.map((c) => (
          <ContestCard key={c.id} c={c} />
        ))}
        {active.length === 0 && (
          <GlassCard className="col-span-full text-center py-10">
            <Trophy className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-muted-foreground">No upcoming contests right now.</p>
          </GlassCard>
        )}
      </div>
    </Page>
  );
}

function ChartCard({
  title,
  config,
  data,
  dataKey,
  yLabel,
  reverse = false,
}: {
  title: string;
  config: { [key: string]: { label: string; color: string } };
  data: Array<{
    label: string;
    contestTitle: string;
    score: number;
    rank: number;
    timeMinutes: number;
  }>;
  dataKey: "score" | "rank" | "timeMinutes";
  yLabel: string;
  reverse?: boolean;
}) {
  return (
    <GlassCard>
      <h3 className="font-semibold">{title}</h3>
      <ChartContainer config={config} className="mt-3 h-52 w-full aspect-auto">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis reversed={reverse} tickLine={false} axisLine={false} width={32} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => payload?.[0]?.payload?.contestTitle ?? yLabel}
              />
            }
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={`var(--color-${dataKey})`}
            strokeWidth={2.5}
            dot={{ r: 3, fill: `var(--color-${dataKey})` }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ChartContainer>
    </GlassCard>
  );
}
