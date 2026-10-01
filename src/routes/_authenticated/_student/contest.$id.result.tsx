import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Page, PageHeader, GlassCard } from "@/components/ui-kit";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import { contestQuery, leaderboardQuery } from "@/lib/queries";
import { contestStatus, mmss } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/_student/contest/$id/result")({
  head: () => ({ meta: [{ title: "Contest result — nilgiriContest" }] }),
  component: Result,
});

function Result() {
  const { id } = Route.useParams();
  const { authInfo } = Route.useRouteContext();
  const { data: c } = useQuery(contestQuery(id));
  const { data: rows = [] } = useQuery(leaderboardQuery(id));
  if (!c)
    return (
      <Page>
        <p className="text-muted-foreground">Loading…</p>
      </Page>
    );
  if (contestStatus(c) !== "closed")
    return (
      <Page>
        <PageHeader title={c.title} subtitle="Results appear after the contest closes." />
      </Page>
    );
  const rank = rows.findIndex((r) => r.userId === authInfo.userId);
  const me = rows[rank];
  return (
    <Page>
      <PageHeader title={c.title} subtitle="Final standings" />
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <GlassCard>
          <div className="text-xs text-muted-foreground">Your score</div>
          <div className="mt-1 font-mono text-3xl font-bold text-gradient">
            {me ? me.score.toFixed(2) : "—"}
            <span className="text-base text-muted-foreground"> / 20</span>
          </div>
        </GlassCard>
        <GlassCard>
          <div className="text-xs text-muted-foreground">Rank</div>
          <div className="mt-1 font-mono text-3xl font-bold">
            {me ? `#${rank + 1} of ${rows.length}` : "Not attempted"}
          </div>
        </GlassCard>
        <GlassCard>
          <div className="text-xs text-muted-foreground">Time taken</div>
          <div className="mt-1 font-mono text-3xl font-bold">{me ? mmss(me.time) : "—"}</div>
        </GlassCard>
      </div>
      <LeaderboardTable rows={rows} highlight={authInfo.userId} />
    </Page>
  );
}
