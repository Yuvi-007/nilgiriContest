import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, StatusPill } from "@/components/ui-kit";
import { contestsQuery } from "@/lib/queries";
import { contestStatus, formatIST } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/_admin/admin/contests")({
  head: () => ({ meta: [{ title: "Contests — nilgiriContest admin" }] }),
  component: AdminContests,
});

function AdminContests() {
  const { data = [] } = useQuery(contestsQuery);
  return (
    <>
      <PageHeader title="Contests" subtitle="Status is derived from the time window. Published contests are locked." />
      <div className="glass overflow-x-auto rounded-2xl">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground"><tr className="border-b border-border"><th className="p-3">Title</th><th className="p-3">Status</th><th className="p-3">Window (IST)</th><th className="p-3">Duration</th><th className="p-3">Type</th></tr></thead>
          <tbody>
            {data.map((c) => (
              <tr key={c.id} className="border-b border-border/50 last:border-0">
                <td className="p-3 font-medium">{c.title}</td>
                <td className="p-3"><StatusPill status={contestStatus(c)} /></td>
                <td className="p-3 font-mono text-xs text-muted-foreground">{formatIST(c.start_time)} → {formatIST(c.end_time)}</td>
                <td className="p-3 font-mono">{c.duration_minutes}m</td>
                <td className="p-3">{c.is_practice ? <span className="text-gold">Practice</span> : "Ranked"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
