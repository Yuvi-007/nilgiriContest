import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, GlassCard } from "@/components/ui-kit";
import { contestsQuery } from "@/lib/queries";
import { contestStatus } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/_admin/admin/")({
  head: () => ({ meta: [{ title: "Admin — nilgiriContest" }] }),
  component: AdminHome,
});

function AdminHome() {
  const { data: contests = [] } = useQuery(contestsQuery);
  const { data: counts } = useQuery({
    queryKey: ["admin-counts"],
    queryFn: async () => {
      const [s, q] = await Promise.all([
        supabase
          .from("user_roles")
          .select("*", { count: "exact", head: true })
          .eq("role", "student"),
        supabase.from("questions").select("*", { count: "exact", head: true }),
      ]);
      return { students: s.count ?? 0, questions: q.count ?? 0 };
    },
  });
  const live = contests.filter((c) => contestStatus(c) === "live").length;
  const cards = [
    ["Students", counts?.students ?? "…"],
    ["Questions", counts?.questions ?? "…"],
    ["Contests", contests.length],
    ["Live now", live],
  ];
  return (
    <>
      <PageHeader title="Admin" subtitle="Cohort overview" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([l, v]) => (
          <GlassCard key={l as string}>
            <div className="text-xs text-muted-foreground">{l}</div>
            <div className="mt-1 font-mono text-3xl font-bold">{v}</div>
          </GlassCard>
        ))}
      </div>
    </>
  );
}
