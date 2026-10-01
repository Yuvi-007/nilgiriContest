import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Page, PageHeader, GlassCard } from "@/components/ui-kit";
import { contestQuery, contestQuestionsQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/_student/contest/$id/review")({
  head: () => ({ meta: [{ title: "Review attempt — nilgiriContest" }] }),
  ssr: false,
  component: Review,
});

function Review() {
  const { id } = Route.useParams();
  const { data: c } = useQuery(contestQuery(id));
  const { data: questionRows = [], isLoading } = useQuery(contestQuestionsQuery(id));
  const { data: attempt } = useQuery({
    queryKey: ["contest-attempt", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_contest_attempt", { _contest_id: id });
      if (error) throw error;
      return data as { answers?: Record<string, string>; submittedAt?: string | null } | null;
    },
  });
  const [draftAnswers] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem(`nilgiri-attempt-${id}`) ?? "{}") as Record<
        string,
        string
      >;
    } catch {
      return {};
    }
  });
  const answers = attempt?.answers ?? draftAnswers;
  return (
    <Page>
      <PageHeader
        title={c ? `Review · ${c.title}` : "Review"}
        subtitle="Your answers and per-question marks."
      />
      {isLoading ? (
        <p className="text-muted-foreground">Loading review...</p>
      ) : questionRows.length === 0 ? (
        <GlassCard>
          <p className="text-muted-foreground">No saved answers were found for this contest.</p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {questionRows.map(({ position, question }) => (
            <GlassCard key={question.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-xs uppercase text-cyan">Question {position}</p>
                  <h2 className="mt-1 font-semibold">{question.title}</h2>
                </div>
                <span className="font-mono text-sm text-gold">
                  {question.marks} mark{question.marks === 1 ? "" : "s"}
                </span>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">
                {answers[question.id]
                  ? question.type === "mcq" && Array.isArray(question.options)
                    ? String(question.options[Number(answers[question.id])] ?? "No answer")
                    : answers[question.id]
                  : "Not answered"}
              </p>
              {c?.show_solutions_after_close && (
                <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
                  Solutions will be shown when the contest is closed.
                </p>
              )}
            </GlassCard>
          ))}
        </div>
      )}
    </Page>
  );
}
