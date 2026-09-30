import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Page, PageHeader, GlassCard } from "@/components/ui-kit";
import { contestQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/_student/contest/$id/review")({
  head: () => ({ meta: [{ title: "Review attempt — nilgiriContest" }] }),
  component: Review,
});

function Review() {
  const { id } = Route.useParams();
  const { data: c } = useQuery(contestQuery(id));
  return (
    <Page>
      <PageHeader title={c ? `Review · ${c.title}` : "Review"} subtitle="Your answers and per-question marks." />
      <GlassCard>
        <p className="text-muted-foreground">
          Per-question review opens once attempts are recorded in the arena (next phase).
          {c?.show_solutions_after_close ? " Solutions will be shown for this contest." : " Solutions are hidden for this contest."}
        </p>
      </GlassCard>
    </Page>
  );
}
