import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui-kit";
import { formatIST } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/_admin/admin/audit")({
  head: () => ({ meta: [{ title: "Audit log — nilgiriContest admin" }] }),
  component: Audit,
});

const color: Record<string, string> = { login_success: "text-green", login_failed: "text-orange", login_locked: "text-destructive" };

function Audit() {
  const { data = [] } = useQuery({
    queryKey: ["audit"],
    queryFn: async () => (await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(200)).data ?? [],
  });
  return (
    <>
      <PageHeader title="Audit log" subtitle="Latest 200 events" />
      <div className="glass overflow-x-auto rounded-2xl">
        <table className="w-full font-mono text-xs">
          <thead className="text-left uppercase text-muted-foreground"><tr className="border-b border-border"><th className="p-3">Time</th><th className="p-3">Actor</th><th className="p-3">Action</th><th className="p-3">Details</th></tr></thead>
          <tbody>
            {data.map((a) => (
              <tr key={a.id} className="border-b border-border/50 last:border-0">
                <td className="p-3 text-muted-foreground">{formatIST(a.created_at, { second: "2-digit" })}</td>
                <td className="p-3">{a.actor_login_id}</td>
                <td className={`p-3 ${color[a.action] ?? ""}`}>{a.action}</td>
                <td className="p-3 text-muted-foreground">{JSON.stringify(a.details)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
