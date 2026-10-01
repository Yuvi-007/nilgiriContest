import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Page, PageHeader, GlassCard } from "@/components/ui-kit";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ContestCard } from "@/components/ContestCard";
import { contestsQuery, dashboardHistoryQuery, leaderboardQuery } from "@/lib/queries";
import { contestStatus } from "@/lib/time";

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

  return (
    <Page>
      <PageHeader
        title={`Hi, ${authInfo.fullName.split(" ")[0]}`}
        subtitle="Here's what's happening in the cohort."
      />
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <GlassCard>
          <div className="text-xs text-muted-foreground">Overall rank</div>
          <div className="mt-1 font-mono text-3xl font-bold">{me ? `#${rank + 1}` : "—"}</div>
        </GlassCard>
        <GlassCard>
          <div className="text-xs text-muted-foreground">Total score</div>
          <div className="mt-1 font-mono text-3xl font-bold text-gradient">
            {me ? me.score.toFixed(1) : "0"}
          </div>
        </GlassCard>
        <GlassCard>
          <div className="text-xs text-muted-foreground">Contests taken</div>
          <div className="mt-1 font-mono text-3xl font-bold">{me?.contests ?? 0}</div>
        </GlassCard>
      </div>
      <section className="mb-10" aria-labelledby="performance-heading">
        <div className="mb-4">
          <h2 id="performance-heading" className="text-lg font-bold">
            Performance history
          </h2>
          <p className="text-sm text-muted-foreground">Closed ranked contests only.</p>
        </div>
        {historyLoading ? (
          <GlassCard>
            <p className="text-sm text-muted-foreground">Loading performance history...</p>
          </GlassCard>
        ) : history.length === 0 ? (
          <GlassCard>
            <p className="text-sm text-muted-foreground">
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
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">Live & upcoming</h2>
        <Link to="/contests" className="text-sm text-violet hover:underline">
          All contests →
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {active.map((c) => (
          <ContestCard key={c.id} c={c} />
        ))}
        {active.length === 0 && <p className="text-muted-foreground">No upcoming contests.</p>}
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
