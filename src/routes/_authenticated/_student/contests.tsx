import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Page, PageHeader } from "@/components/ui-kit";
import { ContestCard } from "@/components/ContestCard";
import { contestsQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/_student/contests")({
  head: () => ({ meta: [{ title: "Contests — nilgiriContest" }] }),
  component: Contests,
});

function Contests() {
  const { data = [], isLoading } = useQuery(contestsQuery);
  return (
    <Page>
      <PageHeader title="Contests" subtitle="All times in IST." />
      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.map((c) => (
            <ContestCard key={c.id} c={c} />
          ))}
        </div>
      )}
    </Page>
  );
}
