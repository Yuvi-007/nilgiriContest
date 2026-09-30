import { createFileRoute } from "@tanstack/react-router";
import { Page, PageHeader, GlassCard } from "@/components/ui-kit";

export const Route = createFileRoute("/rules")({
  head: () => ({
    meta: [
      { title: "Contest rules — nilgiriContest" },
      { name: "description", content: "Scoring, timing, ranking and zero-tolerance anti-cheating rules for nilgiriContest." },
      { property: "og:title", content: "Contest rules — nilgiriContest" },
      { property: "og:description", content: "Scoring, timing, ranking and anti-cheating rules." },
    ],
  }),
  component: Rules,
});

const sections: { t: string; items: string[] }[] = [
  { t: "Format", items: ["8 questions: 5 MCQs + 3 coding problems.", "Total 20 marks: MCQ 1 each; coding Easy 3, Medium 5, Hard 7.", "60 minutes once you start — never beyond the contest end time.", "All times are shown in IST (Asia/Kolkata)."] },
  { t: "Scoring", items: ["Coding marks are partial: (hidden tests passed ÷ total tests) × marks.", "Contest ranking: score high→low, then total time taken low→high.", "Leaderboards appear only after the contest closes.", "Overall leaderboard sums all non-practice contests."] },
  { t: "Zero tolerance", items: ["Stay in fullscreen; leaving the tab or window is recorded as a violation.", "Copy, paste and right-click are disabled in the arena.", "Practice contests follow the same rules but never affect your stats."] },
  { t: "Accounts", items: ["Accounts are issued by the admin — there is no public sign-up.", "Change your password on first login.", "5 wrong passwords lock the ID for 15 minutes. Ask the admin for a reset."] },
];

function Rules() {
  return (
    <Page>
      <PageHeader title="Rules" subtitle="Read these before your first contest." />
      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((s) => (
          <GlassCard key={s.t}>
            <h2 className="text-lg font-bold">{s.t}</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {s.items.map((i) => (
                <li key={i} className="flex gap-2"><span className="text-violet">▸</span>{i}</li>
              ))}
            </ul>
          </GlassCard>
        ))}
      </div>
    </Page>
  );
}
