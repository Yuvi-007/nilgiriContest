import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui-kit";
import { contestStatus, formatIST } from "@/lib/time";
import type { Tables } from "@/integrations/supabase/types";

export function ContestCard({ c }: { c: Tables<"contests"> }) {
  const status = contestStatus(c);
  return (
    <div className="glass flex flex-col gap-3 rounded-2xl p-5">
      <div className="flex items-center justify-between gap-2">
        <StatusPill status={status} />
        {c.is_practice && <span className="font-mono text-xs text-gold">PRACTICE</span>}
      </div>
      <div>
        <h3 className="font-bold">{c.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{c.description}</p>
      </div>
      <div className="font-mono text-xs text-muted-foreground">
        {formatIST(c.start_time)} → {formatIST(c.end_time)} · {c.duration_minutes} min · 20 marks
      </div>
      <div className="mt-auto flex gap-2">
        {status === "live" && (
          <Link to="/contest/$id/lobby" params={{ id: c.id }}>
            <Button size="sm" className="bg-gradient-primary">
              Enter lobby
            </Button>
          </Link>
        )}
        {status === "scheduled" && (
          <Link to="/contest/$id/lobby" params={{ id: c.id }}>
            <Button size="sm" variant="secondary">
              View lobby
            </Button>
          </Link>
        )}
        {status === "closed" && (
          <>
            <Link to="/contest/$id/result" params={{ id: c.id }}>
              <Button size="sm" variant="secondary">
                Result
              </Button>
            </Link>
            <Link to="/contest/$id/review" params={{ id: c.id }}>
              <Button size="sm" variant="ghost">
                Review
              </Button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
