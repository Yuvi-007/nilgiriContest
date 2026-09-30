import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useNow } from "@/components/Navbar";
import { contestQuery } from "@/lib/queries";
import { hms } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/_student/contest/$id/arena")({
  head: () => ({ meta: [{ title: "Arena — nilgiriContest" }] }),
  component: Arena,
});

// Phase 1: arena shell with the slim status bar and calm mode.
// Questions, answering, anti-cheat and grading arrive in the next phase.
function Arena() {
  const { id } = Route.useParams();
  const { authInfo } = Route.useRouteContext();
  const { data: c } = useQuery(contestQuery(id));
  const [startedAt] = useState(() => Date.now());
  const now = useNow() ?? startedAt;
  const [deadline, setDeadline] = useState<number | null>(null);

  useEffect(() => {
    if (c) setDeadline(Math.min(startedAt + c.duration_minutes * 60_000, new Date(c.end_time).getTime()));
  }, [c, startedAt]);

  return (
    <div className="calm min-h-screen bg-background">
      <div className="sticky top-0 z-40 flex h-11 items-center gap-4 border-b border-border bg-bg2 px-4 text-sm">
        <span className="font-extrabold">nilgiri<span className="text-primary">Contest</span></span>
        <span className="truncate text-muted-foreground">{c?.title ?? "…"}</span>
        <span className="ml-auto font-mono text-muted-foreground">{authInfo.loginId}</span>
        <span className="rounded-md bg-bg3 px-2 py-0.5 font-mono text-cyan">{deadline ? hms(deadline - now) : "--:--:--"}</span>
        <Link to="/contest/$id/lobby" params={{ id }}><Button size="sm" variant="secondary" className="h-7">Exit</Button></Link>
      </div>
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <div className="glass rounded-2xl p-10">
          <h1 className="text-2xl font-bold">Arena</h1>
          <p className="mt-2 text-muted-foreground">Calm mode is on: solid panels, no blur or motion. Questions and the code editor will appear here in the next phase.</p>
        </div>
      </div>
    </div>
  );
}
