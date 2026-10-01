import React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  BookOpen,
  Trophy,
  Radio,
  ArrowRight,
  TrendingUp,
  ClipboardList,
} from "lucide-react";
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

  const live = contests.filter((c) => contestStatus(c) === "live");
  const upcoming = contests.filter((c) => contestStatus(c) === "scheduled");

  const statCards: {
    label: string;
    value: number | string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bg: string;
    border: string;
    to: string;
    pulse?: boolean;
  }[] = [
    {
      label: "Total students",
      value: counts?.students ?? "…",
      icon: Users,
      color: "text-cyan",
      bg: "bg-cyan/10",
      border: "border-cyan/20",
      to: "/admin/students",
    },
    {
      label: "Questions",
      value: counts?.questions ?? "…",
      icon: BookOpen,
      color: "text-violet",
      bg: "bg-violet/10",
      border: "border-violet/20",
      to: "/admin/questions",
    },
    {
      label: "Total contests",
      value: contests.length,
      icon: Trophy,
      color: "text-gold",
      bg: "bg-gold/10",
      border: "border-gold/20",
      to: "/admin/contests",
    },
    {
      label: "Live now",
      value: live.length,
      icon: Radio,
      color: "text-green",
      bg: "bg-green/10",
      border: "border-green/20",
      pulse: live.length > 0,
      to: "/admin/contests",
    },
  ];

  return (
    <>
      <PageHeader
        title="Admin overview"
        subtitle="Monitor your cohort at a glance."
      />

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon, color, bg, border, pulse, to }) => (
          <Link key={label} to={to} className="group block">
            <div
              className={`glass rounded-2xl border p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${border}`}
            >
              <div className="flex items-start justify-between">
                <div className={`rounded-xl ${bg} p-2.5`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                {pulse && (
                  <span className="flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-2.5 w-2.5 animate-ping rounded-full bg-green opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green" />
                  </span>
                )}
              </div>
              <div className="mt-4">
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className={`mt-1 font-mono text-3xl font-bold ${color}`}>{value}</div>
              </div>
              <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                View details <ArrowRight className="h-3 w-3" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Live contests alert */}
      {live.length > 0 && (
        <div className="mt-6 rounded-xl border border-green/30 bg-green/8 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-2.5 w-2.5 animate-ping rounded-full bg-green opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green" />
            </span>
            <p className="text-sm font-semibold text-green">
              {live.length} contest{live.length > 1 ? "s" : ""} live right now
            </p>
            <Link
              to="/admin/contests"
              className="ml-auto text-xs text-green/70 underline hover:text-green"
            >
              Monitor →
            </Link>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 pl-5">
            {live.map((c) => (
              <span
                key={c.id}
                className="rounded-full border border-green/20 bg-green/10 px-2.5 py-0.5 font-mono text-xs text-green"
              >
                {c.title}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <GlassCard className="hover:-translate-y-0.5 transition-transform duration-200">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-violet" />
            <h2 className="font-semibold">Upcoming contests</h2>
            <span className="ml-auto rounded-full bg-violet/10 px-2 py-0.5 font-mono text-xs text-violet">
              {upcoming.length}
            </span>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scheduled contests.</p>
          ) : (
            <ul className="space-y-2">
              {upcoming.slice(0, 4).map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-sm">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />
                  <span className="truncate text-muted-foreground">{c.title}</span>
                </li>
              ))}
            </ul>
          )}
          <Link
            to="/admin/contests"
            className="mt-4 flex items-center gap-1 text-xs text-violet hover:underline"
          >
            Manage contests <ArrowRight className="h-3 w-3" />
          </Link>
        </GlassCard>

        <GlassCard className="hover:-translate-y-0.5 transition-transform duration-200">
          <div className="mb-3 flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-gold" />
            <h2 className="font-semibold">Quick actions</h2>
          </div>
          <div className="grid gap-2">
            {[
              { label: "Add student", to: "/admin/students" },
              { label: "Create question", to: "/admin/questions" },
              { label: "Schedule contest", to: "/admin/contests" },
              { label: "View audit log", to: "/admin/audit" },
            ].map(({ label, to }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center justify-between rounded-lg border border-border bg-bg3 px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-violet/30 hover:text-foreground"
              >
                {label}
                <ArrowRight className="h-3.5 w-3.5 opacity-50" />
              </Link>
            ))}
          </div>
        </GlassCard>
      </div>
    </>
  );
}
