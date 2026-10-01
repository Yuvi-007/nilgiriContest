import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getHomepageSnapshot } from "@/lib/homepage.functions";

export const homepageQuery = queryOptions({
  queryKey: ["homepage-snapshot"],
  queryFn: () => getHomepageSnapshot(),
  staleTime: 60_000,
});

export const contestsQuery = queryOptions({
  queryKey: ["contests"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("contests")
      .select("*")
      .order("start_time", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export const contestQuery = (id: string) =>
  queryOptions({
    queryKey: ["contest", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contests")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const contestQuestionsQuery = (contestId: string) =>
  queryOptions({
    queryKey: ["contest-questions", contestId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_contest_questions", {
        _contest_id: contestId,
      });
      if (error) throw error;
      return (data ?? []).map((question) => ({ position: question.position, question }));
    },
  });

export type LeaderRow = {
  userId: string;
  loginId: string;
  name: string;
  score: number;
  time: number;
  last: string;
  contests: number;
};

/** Overall = sum over non-practice closed contests; ties: lower total time, then earlier last submission. */
export const leaderboardQuery = (contestId?: string) =>
  queryOptions({
    queryKey: ["leaderboard", contestId ?? "overall"],
    queryFn: async (): Promise<LeaderRow[]> => {
      const [{ data: contests }, { data: results }, { data: profiles }] = await Promise.all([
        supabase.from("contests").select("id,is_practice,end_time"),
        supabase.from("contest_results").select("*"),
        supabase.from("profiles").select("id,login_id,full_name"),
      ]);
      const now = Date.now();
      const valid = new Set(
        (contests ?? [])
          .filter(
            (c) =>
              (contestId ? c.id === contestId : !c.is_practice) &&
              new Date(c.end_time).getTime() < now,
          )
          .map((c) => c.id),
      );
      const byUser = new Map<string, LeaderRow>();
      for (const r of results ?? []) {
        if (!valid.has(r.contest_id)) continue;
        const p = profiles?.find((x) => x.id === r.user_id);
        const row = byUser.get(r.user_id) ?? {
          userId: r.user_id,
          loginId: p?.login_id ?? "?",
          name: p?.full_name ?? "Unknown",
          score: 0,
          time: 0,
          last: r.submitted_at,
          contests: 0,
        };
        row.score += Number(r.score);
        row.time += r.time_taken_seconds;
        row.contests += 1;
        if (r.submitted_at > row.last) row.last = r.submitted_at;
        byUser.set(r.user_id, row);
      }
      return [...byUser.values()].sort(
        (a, b) => b.score - a.score || a.time - b.time || a.last.localeCompare(b.last),
      );
    },
  });

export type DashboardHistoryPoint = {
  label: string;
  contestTitle: string;
  score: number;
  rank: number;
  timeMinutes: number;
};

export const dashboardHistoryQuery = (userId: string) =>
  queryOptions({
    queryKey: ["dashboard-history", userId],
    queryFn: async (): Promise<DashboardHistoryPoint[]> => {
      const [{ data: contests, error: contestsError }, { data: results, error: resultsError }] =
        await Promise.all([
          supabase.from("contests").select("id,title,end_time,is_practice").order("end_time"),
          supabase
            .from("contest_results")
            .select("contest_id,user_id,score,time_taken_seconds,submitted_at"),
        ]);
      if (contestsError) throw contestsError;
      if (resultsError) throw resultsError;
      const closed = (contests ?? []).filter(
        (contest) => !contest.is_practice && new Date(contest.end_time).getTime() < Date.now(),
      );
      return closed.flatMap((contest, index) => {
        const contestResults = (results ?? []).filter((result) => result.contest_id === contest.id);
        const mine = contestResults.find((result) => result.user_id === userId);
        if (!mine) return [];
        const rank =
          [...contestResults]
            .sort(
              (a, b) =>
                Number(b.score) - Number(a.score) ||
                a.time_taken_seconds - b.time_taken_seconds ||
                a.submitted_at.localeCompare(b.submitted_at),
            )
            .findIndex((result) => result.user_id === userId) + 1;
        return [
          {
            label: `C${index + 1}`,
            contestTitle: contest.title,
            score: Number(mine.score),
            rank,
            timeMinutes: Number((mine.time_taken_seconds / 60).toFixed(1)),
          },
        ];
      });
    },
  });

export type StudentAttemptStatus = {
  status: "not_started" | "in_progress" | "submitted" | "terminated" | "not_found" | "unauthenticated";
  attempt_id?: string;
  started_at?: string;
  submitted_at?: string;
  deadline?: string;
  violations?: number;
  score?: number;
  is_submitted?: boolean;
};

export const studentAttemptStatusQuery = (contestId: string) =>
  queryOptions({
    queryKey: ["student-attempt-status", contestId],
    queryFn: async (): Promise<StudentAttemptStatus> => {
      const { data, error } = await supabase.rpc("get_student_attempt_status", {
        _contest_id: contestId,
      });
      if (error) {
        return { status: "not_started" };
      }
      return (data as StudentAttemptStatus) ?? { status: "not_started" };
    },
  });
