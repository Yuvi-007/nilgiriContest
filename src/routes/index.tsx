import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Check,
  Clock3,
  Code2,
  Eye,
  FileClock,
  Radio,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Trophy,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { useAuth, homeFor } from "@/lib/auth";
import { homepageQuery } from "@/lib/queries";
import { formatIST, hms, mmss } from "@/lib/time";
import { useCountUp } from "@/hooks/use-count-up";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "nilgiriContest — Daily contests for the Nilgiri cohort" },
      { name: "description", content: "Time-bound daily contests with anti-cheating, auto-grading, leaderboards and analytics for a closed cohort." },
      { property: "og:title", content: "nilgiriContest — Daily contests for the Nilgiri cohort" },
      { property: "og:description", content: "Time-bound daily contests with anti-cheating, auto-grading and leaderboards." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const features = [
  { icon: ShieldCheck, t: "Zero-Tolerance Anti-Cheat", d: "Tab switches, fullscreen exits, and copy-paste attempts are detected and recorded." },
  { icon: TerminalSquare, t: "Real-time Multi-Language Sandbox", d: "Write and test solutions in Python, C++, Java, and JavaScript." },
  { icon: Clock3, t: "Authoritative Timer & Autosave", d: "The server keeps the official time while every answer is preserved automatically." },
  { icon: BarChart3, t: "Transparent IST Leaderboards", d: "Scores, completion times, and standings appear after each contest closes." },
  { icon: Code2, t: "20-Mark Standard", d: "Five MCQs plus Easy, Medium, and Hard coding problems in every round." },
  { icon: Eye, t: "Admin Live Monitoring", d: "Active sessions, violations, and instant audit logs stay visible to the administrator." },
];

const topics = ["Python", "C++", "Java", "JavaScript", "DSA", "Algorithms", "SQL", "System Design"];
const answers = ["O(n)", "O(log n)", "O(n log n)", "O(1)"];
const podium = ["Gold", "Silver", "Bronze"];

function LiveTimer() {
  const [remaining, setRemaining] = useState(42 * 60 + 17);
  useEffect(() => {
    const id = window.setInterval(() => setRemaining((value) => (value > 0 ? value - 1 : 42 * 60 + 17)), 1000);
    return () => window.clearInterval(id);
  }, []);
  return <span>{hms(remaining * 1000)}</span>;
}

function MockQuestion() {
  const [selected, setSelected] = useState(1);
  const card = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  function move(event: MouseEvent<HTMLDivElement>) {
    if (reduced || !card.current) return;
    const bounds = card.current.getBoundingClientRect();
    const rotateY = ((event.clientX - bounds.left) / bounds.width - 0.5) * 8;
    const rotateX = ((event.clientY - bounds.top) / bounds.height - 0.5) * -8;
    card.current.style.setProperty("--tilt-x", `${rotateX}deg`);
    card.current.style.setProperty("--tilt-y", `${rotateY}deg`);
  }

  function reset() {
    card.current?.style.setProperty("--tilt-x", "0deg");
    card.current?.style.setProperty("--tilt-y", "0deg");
  }

  return (
    <div className="hero-card-wrap relative mx-auto w-full max-w-xl lg:mx-0">
      <span className="float-chip float-chip-left font-mono">+1 mark</span>
      <span className="float-chip float-chip-right"><Radio className="h-3 w-3 text-green" /> autosaved</span>
      <div ref={card} onMouseMove={move} onMouseLeave={reset} className="hero-question glass relative overflow-hidden rounded-lg p-5 sm:p-7">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="rounded bg-primary/15 px-2 py-1 font-mono text-cyan">MCQ 02</span><span>1 mark</span></div>
          <div className="flex items-center gap-2 font-mono text-sm text-foreground"><Clock3 className="h-4 w-4 text-cyan" /><LiveTimer /></div>
        </div>
        <div className="pt-6">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Binary search</p>
          <h2 className="mt-2 text-xl font-bold leading-snug sm:text-2xl">What is the worst-case time complexity on a sorted array?</h2>
          <div className="mt-6 grid gap-2.5" role="radiogroup" aria-label="Mock question answers">
            {answers.map((answer, index) => (
              <Button
                type="button"
                variant="ghost"
                key={answer}
                role="radio"
                aria-checked={selected === index}
                onClick={() => setSelected(index)}
                className={cn("answer-option h-auto w-full justify-start rounded-md border px-4 py-3 text-left font-mono", selected === index ? "is-selected border-green/50 bg-green/10 text-foreground" : "border-border bg-secondary/40 text-muted-foreground")}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-xs">{selected === index ? <Check className="h-3.5 w-3.5" /> : String.fromCharCode(65 + index)}</span>
                {answer}
              </Button>
            ))}
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground"><span>Question 2 of 8</span><span className="text-green">Answer saved</span></div>
      </div>
    </div>
  );
}

function Stat({ value, label, decimals = 0, suffix = "" }: { value: number | null; label: string; decimals?: number; suffix?: string }) {
  const count = useCountUp(value);
  return (
    <div ref={count.ref} className="border-l border-border pl-5 first:border-l-0 first:pl-0 sm:pl-8">
      <div className="font-mono text-3xl font-bold tracking-normal text-foreground sm:text-4xl">
        {value === null ? "—" : `${count.value.toFixed(decimals)}${suffix}`}
      </div>
      <div className="mt-1 text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

function Home() {
  const { auth } = useAuth();
  const { data, isLoading, isError } = useQuery(homepageQuery);
  const primaryLabel = auth ? (data?.activeContest && auth.role === "student" ? "Enter Contest" : "Open dashboard") : "Enter Contest";
  const primaryHref = auth?.role === "student" && data?.activeContest
    ? `/contest/${data.activeContest.id}/lobby`
    : auth ? homeFor(auth.role) : "/login";

  return (
    <div className="relative overflow-hidden bg-background">
      <section className="hero-shell relative border-b border-border">
        <div className="aurora" />
        <div className="particle-field" aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <i key={i} />)}</div>
        <div className="relative z-10 mx-auto grid min-h-[min(820px,calc(100svh-4rem))] max-w-6xl items-center gap-16 px-4 py-16 lg:grid-cols-[1.02fr_.98fr] lg:py-20">
          <div>
            <div className="reveal-word inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green" /> Cohort Daily Contests
            </div>
            <h1 className="mt-6 max-w-3xl text-5xl font-black leading-[1.02] tracking-normal sm:text-6xl lg:text-7xl">
              <span className="reveal-word delay-1 inline-block">Think.</span>{" "}
              <span className="reveal-word delay-2 inline-block">Code.</span>{" "}
              <span className="reveal-word delay-3 inline-block">Rise.</span><br />
              <span className="reveal-word delay-4 text-flow inline-block">Every single day.</span>
            </h1>
            <p className="reveal-word delay-5 mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Eight focused problems. One authoritative hour. A fair, secure arena built for the Nilgiri cohort to sharpen skills and earn every rank.
            </p>
            <div className="reveal-word delay-6 mt-9 flex flex-wrap gap-3">
              <Button asChild size="lg" className="shimmer-button bg-gradient-primary px-7 shadow-glow">
                <a href={primaryHref}>{primaryLabel}<ArrowRight /></a>
              </Button>
              <Button asChild size="lg" variant="ghost" className="border border-border bg-secondary/30 px-7">
                <Link to="/rules">View Rules</Link>
              </Button>
            </div>
          </div>
          <MockQuestion />
        </div>
      </section>

      <section aria-label="Live platform statistics" className="border-b border-border bg-bg2/80">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-y-8 px-4 py-10 sm:grid-cols-4 sm:gap-y-0">
          {isLoading ? <p className="col-span-full text-center text-sm text-muted-foreground">Loading live statistics…</p> : isError ? <p className="col-span-full text-center text-sm text-muted-foreground">Live statistics are temporarily unavailable.</p> : <>
            <Stat value={data?.activeStudents ?? 0} label="active students" />
            <Stat value={data?.contestsHeld ?? 0} label="contests held" />
            <Stat value={data?.totalSubmissions ?? 0} label="submissions" />
            <Stat value={data?.averageScore ?? null} label="average score" decimals={1} suffix=" / 20" />
          </>}
        </div>
      </section>

      <section className="marquee-shell border-b border-border py-5" aria-label="Languages and topics covered">
        <div className="marquee-track">
          {[...topics, ...topics].map((topic, index) => <span key={`${topic}-${index}`} className="marquee-pill"><Sparkles className="h-3 w-3 text-cyan" />{topic}</span>)}
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-4 py-24">
        <div className="max-w-2xl"><p className="font-mono text-xs uppercase text-cyan">Built for focused competition</p><h2 className="mt-3 text-3xl font-extrabold tracking-normal sm:text-4xl">Everything needed for a fair daily contest.</h2></div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div key={f.t} className="feature-card glass rounded-lg p-6">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-primary/10"><f.icon className="h-5 w-5 text-cyan" /></span>
            <h3 className="mt-5 font-semibold">{f.t}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.d}</p>
          </div>
        ))}
        </div>
      </section>

      <section className="border-y border-border bg-bg2/60 py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="font-mono text-xs uppercase text-gold">Latest closed contest</p><h2 className="mt-3 text-3xl font-extrabold tracking-normal sm:text-4xl">The latest podium.</h2>{data?.latestContest && <p className="mt-2 text-sm text-muted-foreground">{data.latestContest.title} · closed {formatIST(data.latestContest.endTime)}</p>}</div><Button asChild variant="secondary"><Link to="/leaderboard">Full leaderboard <ArrowRight /></Link></Button></div>
          {!isLoading && !data?.latestContest ? <div className="mt-10 border-y border-border py-12 text-center text-muted-foreground">The first podium will appear when a contest closes.</div> : (
            <div className="mt-10 grid gap-3 md:grid-cols-3">
              {(data?.latestContest?.leaders ?? []).map((leader, index) => (
                <article key={`${leader.rank}-${leader.name}`} className={cn("podium-card glass rounded-lg p-6", index === 0 && "podium-first")}>
                  <div className="flex items-start justify-between"><span className={cn("podium-medal", `podium-${index + 1}`)}><Trophy className="h-4 w-4" />{podium[index] ?? `#${leader.rank}`}</span><span className="font-mono text-sm text-muted-foreground">#{leader.rank}</span></div>
                  <h3 className="mt-8 text-xl font-bold">{leader.name}</h3>
                  <div className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-4"><div><p className="text-xs text-muted-foreground">Score</p><p className="mt-1 font-mono text-lg">{leader.score.toFixed(2)} / 20</p></div><div><p className="text-xs text-muted-foreground">Time</p><p className="mt-1 font-mono text-lg">{mmss(leader.timeTakenSeconds)}</p></div></div>
                  <p className="mt-4 text-xs text-muted-foreground">Submitted {formatIST(leader.submittedAt)}</p>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="cta-band relative overflow-hidden border-b border-border py-28 text-center">
        <div className="relative z-10 mx-auto max-w-3xl px-4"><Activity className="mx-auto h-7 w-7 text-cyan" /><h2 className="mt-5 text-4xl font-black tracking-normal sm:text-5xl">Your next rank starts here.</h2><p className="mx-auto mt-4 max-w-xl text-muted-foreground">Show up, solve clearly, and let every fair result speak for itself.</p><Button asChild size="lg" className="shimmer-button mt-8 bg-gradient-primary px-8 shadow-glow"><a href={primaryHref}>{primaryLabel}<ArrowRight /></a></Button></div>
      </section>

      <footer className="bg-bg2 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 px-4 sm:flex-row"><Link to="/" className="text-lg font-extrabold">nilgiri<span className="text-gradient">Contest</span></Link><nav className="flex items-center gap-5 text-sm text-muted-foreground" aria-label="Footer"><Link to="/rules" className="hover:text-foreground">Rules</Link><Link to="/leaderboard" className="hover:text-foreground">Leaderboard</Link><a href="#status" className="hover:text-foreground">Status</a></nav><div id="status" className="flex items-center gap-2 text-xs text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-green" /> Operational · © {new Date().getFullYear()}</div></div>
      </footer>
    </div>
  );
}
