import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui-kit";
import { formatIST } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/_admin/admin/students")({
  head: () => ({ meta: [{ title: "Students — nilgiriContest admin" }] }),
  component: Students,
});

function Students() {
  const { data = [] } = useQuery({
    queryKey: ["admin-students"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").order("login_id"),
        supabase.from("user_roles").select("user_id,role"),
      ]);
      const students = new Set((roles ?? []).filter((r) => r.role === "student").map((r) => r.user_id));
      return (profiles ?? []).filter((p) => students.has(p.id));
    },
  });
  return (
    <>
      <PageHeader title="Students" subtitle={`${data.length} of 90 seats used`} />
      <div className="glass overflow-x-auto rounded-2xl">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground"><tr className="border-b border-border"><th className="p-3">ID</th><th className="p-3">Name</th><th className="p-3">Password</th><th className="p-3">Created</th></tr></thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.id} className="border-b border-border/50 last:border-0">
                <td className="p-3 font-mono">{p.login_id}</td>
                <td className="p-3">{p.full_name}</td>
                <td className="p-3">{p.must_change_password ? <span className="text-gold">Must change</span> : <span className="text-green">Set</span>}</td>
                <td className="p-3 font-mono text-xs text-muted-foreground">{formatIST(p.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
