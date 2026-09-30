import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Page, PageHeader, GlassCard } from "@/components/ui-kit";
import { ContestCard } from "@/components/ContestCard";
import { contestsQuery, leaderboardQuery } from "@/lib/queries";
import { contestStatus } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/_student/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — nilgiriContest" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { authInfo } = Route.useRouteContext();
  const { data: contests = [] } = useQuery(contestsQuery);
  const { data: board = [] } = useQuery(leaderboardQuery());
  const rank = board.findIndex((r) => r.userId === authInfo.userId);
  const me = board[rank];
  const active = contests.filter((c) => contestStatus(c) !== "closed");

  return (
    <Page>
      <PageHeader title={`Hi, ${authInfo.fullName.split(" ")[0]}`} subtitle="Here's what's happening in the cohort." />
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <GlassCard><div className="text-xs text-muted-foreground">Overall rank</div><div className="mt-1 font-mono text-3xl font-bold">{me ? `#${rank + 1}` : "—"}</div></GlassCard>
        <GlassCard><div className="text-xs text-muted-foreground">Total score</div><div className="mt-1 font-mono text-3xl font-bold text-gradient">{me ? me.score.toFixed(1) : "0"}</div></GlassCard>
        <GlassCard><div className="text-xs text-muted-foreground">Contests taken</div><div className="mt-1 font-mono text-3xl font-bold">{me?.contests ?? 0}</div></GlassCard>
      </div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">Live & upcoming</h2>
        <Link to="/contests" className="text-sm text-violet hover:underline">All contests →</Link>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {active.map((c) => <ContestCard key={c.id} c={c} />)}
        {active.length === 0 && <p className="text-muted-foreground">No upcoming contests.</p>}
      </div>
    </Page>
  );
}
