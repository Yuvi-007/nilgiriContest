import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Timer, Trophy, Code2, BarChart3, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth, homeFor } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "nilgiriContest — Daily contests for the Nilgiri cohort" },
      { name: "description", content: "Time-bound daily contests with anti-cheating, auto-grading, leaderboards and analytics for a closed cohort." },
      { property: "og:title", content: "nilgiriContest — Daily contests for the Nilgiri cohort" },
      { property: "og:description", content: "Time-bound daily contests with anti-cheating, auto-grading and leaderboards." },
    ],
  }),
  component: Home,
});

const stats = [
  { v: "8", l: "questions daily" },
  { v: "20", l: "marks per contest" },
  { v: "60", l: "minutes, one sitting" },
  { v: "90", l: "students in cohort" },
];

const features = [
  { icon: Timer, t: "Time-bound", d: "One 60-minute sitting inside each contest window." },
  { icon: ShieldCheck, t: "Zero tolerance", d: "Tab switches and copy-paste are detected and logged." },
  { icon: Code2, t: "Auto-graded code", d: "Partial marks from hidden test cases." },
  { icon: Trophy, t: "Leaderboards", d: "Per-contest and overall standings once contests close." },
  { icon: BarChart3, t: "Analytics", d: "Track your progress across every contest." },
  { icon: Lock, t: "Closed cohort", d: "Only pre-provisioned accounts can sign in." },
];

function Home() {
  const { auth } = useAuth();
  return (
    <div className="relative overflow-hidden">
      <div className="aurora" />
      <section className="relative z-10 mx-auto max-w-6xl px-4 pb-20 pt-24 text-center">
        <span className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-green" /> Daily contests · IST
        </span>
        <h1 className="mx-auto mt-6 max-w-4xl text-5xl font-black leading-[1.05] tracking-tight md:text-7xl">
          Compete every day.<br />
          <span className="text-gradient">Climb every week.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          5 MCQs and 3 coding problems, 20 marks, one focused hour. Auto-graded, fairly ranked, built for the Nilgiri cohort.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link to={auth ? homeFor(auth.role) : "/login"}>
            <Button size="lg" className="bg-gradient-primary px-8 shadow-glow">
              {auth ? "Go to dashboard" : "Log in to compete"}
            </Button>
          </Link>
          <Link to="/rules">
            <Button size="lg" variant="secondary" className="px-8">Read the rules</Button>
          </Link>
        </div>
        <div className="mx-auto mt-16 grid max-w-3xl grid-cols-2 gap-3 md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.l} className="glass rounded-2xl p-5">
              <div className="font-mono text-3xl font-bold text-gradient">{s.v}</div>
              <div className="mt-1 text-xs text-muted-foreground">{s.l}</div>
            </div>
          ))}
        </div>
      </section>
      <section className="relative z-10 mx-auto grid max-w-6xl gap-4 px-4 pb-24 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div key={f.t} className="glass rounded-2xl p-6">
            <f.icon className="h-6 w-6 text-violet" />
            <h3 className="mt-4 font-semibold">{f.t}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
