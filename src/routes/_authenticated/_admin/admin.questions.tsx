import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, GlassCard } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/_admin/admin/questions")({
  head: () => ({ meta: [{ title: "Question bank — nilgiriContest admin" }] }),
  component: Questions,
});

const diffColor = { easy: "text-green", medium: "text-gold", hard: "text-orange" } as const;

function Questions() {
  const { data = [] } = useQuery({
    queryKey: ["admin-questions"],
    queryFn: async () => (await supabase.from("questions").select("*").order("type", { ascending: false }).order("marks")).data ?? [],
  });
  return (
    <>
      <PageHeader title="Question bank" subtitle="MCQ = 1 mark · Coding: Easy 3, Medium 5, Hard 7" />
      <div className="grid gap-3 md:grid-cols-2">
        {data.map((q) => (
          <GlassCard key={q.id}>
            <div className="flex items-center justify-between font-mono text-xs uppercase">
              <span className="text-violet">{q.type}</span>
              <span className={q.difficulty ? diffColor[q.difficulty] : "text-muted-foreground"}>{q.difficulty ?? ""} · {q.marks} mark{q.marks > 1 ? "s" : ""}</span>
            </div>
            <h3 className="mt-2 font-semibold">{q.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{q.body}</p>
            {Array.isArray(q.options) && (
              <ol className="mt-2 space-y-0.5 font-mono text-xs">
                {(q.options as string[]).map((o, i) => (
                  <li key={i} className={i === q.correct_option ? "text-green" : "text-muted-foreground"}>{String.fromCharCode(65 + i)}. {o}</li>
                ))}
              </ol>
            )}
          </GlassCard>
        ))}
      </div>
    </>
  );
}
