import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, ArrowLeft, Clock3, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard, PageHeader } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";
import { contestQuery } from "@/lib/queries";
import { formatIST, hms } from "@/lib/time";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_authenticated/_admin/admin/contests/$id/monitor")({
  head: () => ({ meta: [{ title: "Contest monitor — nilgiriContest admin" }] }),
  component: Monitor,
});

function Monitor() {
  const { id } = Route.useParams();
  const { data: contest } = useQuery(contestQuery(id));
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-contest-monitor", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_contest_monitor", { _contest_id: id });
      if (error) throw error;
      return data;
    },
    refetchInterval: 10_000,
  });
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  async function grantTime(attemptId: string) {
    const value = window.prompt("Grant how many extra minutes?", "10");
    const minutes = Number(value);
    if (!Number.isInteger(minutes) || minutes <= 0) return;
    const { error } = await supabase.rpc("admin_grant_extra_time", {
      _attempt_id: attemptId,
      _minutes: minutes,
    });
    if (error) window.alert(error.message);
    else await queryClient.invalidateQueries({ queryKey: ["admin-contest-monitor", id] });
  }

  async function reopen(attemptId: string) {
    const value = window.prompt("Restore how many minutes?", "10");
    const minutes = Number(value);
    if (!Number.isInteger(minutes) || minutes <= 0) return;
    const { error } = await supabase.rpc("admin_reopen_submission", {
      _attempt_id: attemptId,
      _minutes: minutes,
    });
    if (error) window.alert(error.message);
    else await queryClient.invalidateQueries({ queryKey: ["admin-contest-monitor", id] });
  }

  async function terminate(attemptId: string) {
    if (!window.confirm("Terminate and disqualify this attempt?")) return;
    const { error } = await supabase.rpc("admin_terminate_attempt", { _attempt_id: attemptId });
    if (error) window.alert(error.message);
    else await queryClient.invalidateQueries({ queryKey: ["admin-contest-monitor", id] });
  }

  return (
    <>
      <PageHeader
        title={contest ? `Monitor · ${contest.title}` : "Contest monitor"}
        subtitle="Participant presence refreshes every 10 seconds."
      >
        <Link to="/admin/contests">
          <Button variant="secondary">
            <ArrowLeft className="h-4 w-4" /> Contests
          </Button>
        </Link>
      </PageHeader>
      {isLoading ? (
        <p className="text-muted-foreground">Loading participants...</p>
      ) : rows.length === 0 ? (
        <GlassCard>
          <p className="text-muted-foreground">No students have started this contest.</p>
        </GlassCard>
      ) : (
        <div className="glass overflow-x-auto rounded-2xl">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="p-3">Student</th>
                <th className="p-3">Set</th>
                <th className="p-3">Status</th>
                <th className="p-3">Last seen</th>
                <th className="p-3">Started</th>
                <th className="p-3">Progress</th>
                <th className="p-3">Deadline</th>
                <th className="p-3">Violations</th>
                <th className="p-3">Submitted</th>
                <th className="p-3">Controls</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const stale =
                  now - new Date(row.last_seen_at).getTime() > 30_000 && row.status === "active";
                return (
                  <tr key={row.user_id} className="border-b border-border/50 last:border-0">
                    <td className="p-3">
                      <strong className="block">{row.full_name}</strong>
                      <span className="font-mono text-xs text-muted-foreground">
                        {row.login_id}
                      </span>
                    </td>
                    <td className="p-3">
                      {row.assigned_set && row.assigned_set !== "—" ? (
                        <span className="inline-flex items-center rounded-md border border-cyan/40 bg-cyan/15 px-2 py-0.5 font-mono text-xs font-bold text-cyan">
                          Set {row.assigned_set}
                        </span>
                      ) : (
                        <span className="font-mono text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span
                        className={
                          stale
                            ? "text-orange"
                            : row.status === "submitted"
                              ? "text-green"
                              : "text-cyan"
                        }
                      >
                        {stale ? "stale" : row.status}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">
                      {formatIST(row.last_seen_at)}
                    </td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">
                      {formatIST(row.started_at)}
                    </td>
                    <td className="p-3">{row.answers_completed}/8</td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">
                      {row.deadline ? (
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="h-3.5 w-3.5" />
                          {hms(new Date(row.deadline).getTime() - now)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3">{row.violations}</td>
                    <td className="p-3">
                      {row.submitted_at ? (
                        <span className="inline-flex items-center gap-1 text-green">
                          <Activity className="h-3.5 w-3.5" /> {formatIST(row.submitted_at)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {row.attempt_id && row.status === "active" && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7"
                              onClick={() => void grantTime(row.attempt_id!)}
                            >
                              + Time
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-destructive"
                              onClick={() => void terminate(row.attempt_id!)}
                            >
                              <ShieldAlert className="h-3.5 w-3.5" /> End
                            </Button>
                          </>
                        )}
                        {row.attempt_id &&
                          (row.status === "submitted" || row.status === "terminated") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7"
                              onClick={() => void reopen(row.attempt_id!)}
                            >
                              Reopen
                            </Button>
                          )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
