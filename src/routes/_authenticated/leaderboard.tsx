import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Page } from "@/components/ui-kit";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import { contestsQuery, leaderboardQuery } from "@/lib/queries";
import { contestStatus } from "@/lib/time";
import { Trophy, Users, Medal } from "lucide-react";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () => ({ meta: [{ title: "Leaderboard — nilgiriContest" }] }),
  component: Leaderboard,
});

function Leaderboard() {
  const { authInfo } = Route.useRouteContext();
  const [contestId, setContestId] = useState<string>("");
  const { data: contests = [] } = useQuery(contestsQuery);
  const { data: rows = [], isLoading } = useQuery(leaderboardQuery(contestId || undefined));
  const closed = contests.filter((c) => contestStatus(c) === "closed" && !c.is_practice);

  const myRank = rows.findIndex((r) => r.userId === authInfo.userId) + 1;
  const myRow = rows.find((r) => r.userId === authInfo.userId);
  const maxScore = myRow ? 20 * myRow.contests : 0;
  const myPct = myRow && maxScore > 0 ? Math.round((myRow.score / maxScore) * 100) : null;

  return (
    <Page>
      {/* Header */}
      <div className="mb-8">
        <div className="mb-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight">
              <Trophy className="h-8 w-8 text-gold" />
              Leaderboard
              {contestId && (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-sm font-medium text-primary">
                  · Live
                </span>
              )}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {rows.length > 0 ? (
                <>
                  <Users className="mr-1 inline h-3.5 w-3.5" />
                  {rows.length} student{rows.length !== 1 ? "s" : ""} ranked
                  {!contestId && " · MCQ + Coding combined"}
                </>
              ) : (
                "Visible after contests close. Ties: lower time wins."
              )}
            </p>
          </div>

          {/* Your rank chip */}
          {myRank > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-violet/30 bg-violet/8 px-4 py-2">
              <Medal className="h-5 w-5 text-violet" />
              <div className="text-right">
                <div className="font-mono text-xs text-muted-foreground">Your rank</div>
                <div className="font-mono font-bold text-violet">#{myRank}</div>
              </div>
              {myPct !== null && (
                <div className="border-l border-border pl-3 text-right">
                  <div className="font-mono text-xs text-muted-foreground">Score</div>
                  <div className="font-mono font-bold text-cyan">{myPct}%</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Contest filter pills */}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => setContestId("")}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
              contestId === ""
                ? "border-primary bg-primary text-primary-foreground shadow-glow"
                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
          >
            Overall
          </button>
          {closed.map((c) => (
            <button
              key={c.id}
              onClick={() => setContestId(c.id)}
              className={`max-w-[200px] truncate rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                contestId === c.id
                  ? "border-primary bg-primary text-primary-foreground shadow-glow"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {c.title}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <LeaderboardTable rows={rows} highlight={authInfo.userId} />
      )}
    </Page>
  );
}
