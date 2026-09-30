import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Page, PageHeader } from "@/components/ui-kit";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import { contestsQuery, leaderboardQuery } from "@/lib/queries";
import { contestStatus } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () => ({ meta: [{ title: "Leaderboard — nilgiriContest" }] }),
  component: Leaderboard,
});

function Leaderboard() {
  const { authInfo } = Route.useRouteContext();
  const [contestId, setContestId] = useState<string>("");
  const { data: contests = [] } = useQuery(contestsQuery);
  const { data: rows = [] } = useQuery(leaderboardQuery(contestId || undefined));
  const closed = contests.filter((c) => contestStatus(c) === "closed" && !c.is_practice);
  return (
    <Page>
      <PageHeader title="Leaderboard" subtitle="Visible after contests close. Ties: lower time wins.">
        <select value={contestId} onChange={(e) => setContestId(e.target.value)} className="glass rounded-lg px-3 py-2 text-sm">
          <option value="">Overall</option>
          {closed.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </PageHeader>
      <LeaderboardTable rows={rows} highlight={authInfo.userId} />
    </Page>
  );
}
