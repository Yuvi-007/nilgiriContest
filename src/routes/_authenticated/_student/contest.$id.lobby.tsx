import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Page, GlassCard, StatusPill } from "@/components/ui-kit";
import { useNow } from "@/components/Navbar";
import { contestQuery } from "@/lib/queries";
import { contestStatus, formatIST, hms } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/_student/contest/$id/lobby")({
  head: () => ({ meta: [{ title: "Contest lobby — nilgiriContest" }] }),
  component: Lobby,
});

function Lobby() {
  const { id } = Route.useParams();
  const { data: c, isLoading } = useQuery(contestQuery(id));
  const now = useNow() ?? Date.now();
  if (isLoading) return <Page calm><p className="text-muted-foreground">Loading…</p></Page>;
  if (!c) return <Page calm><p>Contest not found.</p></Page>;
  const status = contestStatus(c, now);
  const remainingWindow = new Date(c.end_time).getTime() - now;
  const effective = Math.min(c.duration_minutes * 60_000, Math.max(0, remainingWindow));

  return (
    <Page calm>
      <div className="mx-auto max-w-2xl space-y-4">
        <GlassCard className="p-8">
          <StatusPill status={status} />
          <h1 className="mt-3 text-3xl font-extrabold">{c.title}</h1>
          <p className="mt-2 text-muted-foreground">{c.description}</p>
          <dl className="mt-6 grid grid-cols-2 gap-4 font-mono text-sm">
            <div><dt className="text-muted-foreground">Opens</dt><dd>{formatIST(c.start_time)}</dd></div>
            <div><dt className="text-muted-foreground">Closes</dt><dd>{formatIST(c.end_time)}</dd></div>
            <div><dt className="text-muted-foreground">Your time</dt><dd>{Math.round(effective / 60000)} min</dd></div>
            <div><dt className="text-muted-foreground">Marks</dt><dd>5 MCQ + 3 coding = 20</dd></div>
          </dl>
        </GlassCard>
        <GlassCard>
          <h2 className="font-bold">Before you start</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>The timer starts the moment you enter and cannot be paused.</li>
            <li>Leaving fullscreen or switching tabs is recorded as a violation.</li>
            <li>Copy/paste is disabled in the arena.</li>
          </ul>
        </GlassCard>
        {status === "scheduled" && <p className="text-center font-mono">Starts in {hms(new Date(c.start_time).getTime() - now)}</p>}
        {status === "live" && (
          <Link to="/contest/$id/arena" params={{ id }}><Button size="lg" className="w-full">Start contest</Button></Link>
        )}
        {status === "closed" && <Link to="/contest/$id/result" params={{ id }}><Button className="w-full" variant="secondary">View result</Button></Link>}
      </div>
    </Page>
  );
}
