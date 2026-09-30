import { createFileRoute } from "@tanstack/react-router";
import { Page, PageHeader, GlassCard } from "@/components/ui-kit";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "Features — nilgiriContest" },
      { name: "description", content: "What nilgiriContest offers: timed contests, anti-cheating, auto-grading, leaderboards and analytics." },
      { property: "og:title", content: "Features — nilgiriContest" },
      { property: "og:description", content: "Timed contests, anti-cheating, auto-grading, leaderboards and analytics." },
    ],
  }),
  component: Features,
});

const items = [
  ["Daily contests", "A new 8-question contest each day, scheduled in IST."],
  ["Fair scoring", "20 marks: 5 MCQs (1 each) plus coding Easy 3, Medium 5, Hard 7."],
  ["Partial credit", "Coding marks scale with hidden tests passed."],
  ["Anti-cheating arena", "Fullscreen, calm UI with tab-switch and paste detection."],
  ["Practice rounds", "Same rules, no effect on leaderboards — learn safely."],
  ["Review attempts", "See your answers and per-question marks after a contest closes."],
];

function Features() {
  return (
    <Page>
      <PageHeader title="Features" subtitle="Everything the cohort needs for a daily contest habit." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(([t, d]) => (
          <GlassCard key={t}>
            <h3 className="font-semibold">{t}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{d}</p>
          </GlassCard>
        ))}
      </div>
    </Page>
  );
}
