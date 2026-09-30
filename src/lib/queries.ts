import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const contestsQuery = queryOptions({
  queryKey: ["contests"],
  queryFn: async () => {
    const { data, error } = await supabase.from("contests").select("*").order("start_time", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export const contestQuery = (id: string) =>
  queryOptions({
    queryKey: ["contest", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("contests").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export type LeaderRow = { userId: string; loginId: string; name: string; score: number; time: number; last: string; contests: number };

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
          .filter((c) => (contestId ? c.id === contestId : !c.is_practice) && new Date(c.end_time).getTime() < now)
          .map((c) => c.id),
      );
      const byUser = new Map<string, LeaderRow>();
      for (const r of results ?? []) {
        if (!valid.has(r.contest_id)) continue;
        const p = profiles?.find((x) => x.id === r.user_id);
        const row = byUser.get(r.user_id) ?? {
          userId: r.user_id, loginId: p?.login_id ?? "?", name: p?.full_name ?? "Unknown", score: 0, time: 0, last: r.submitted_at, contests: 0,
        };
        row.score += Number(r.score);
        row.time += r.time_taken_seconds;
        row.contests += 1;
        if (r.submitted_at > row.last) row.last = r.submitted_at;
        byUser.set(r.user_id, row);
      }
      return [...byUser.values()].sort((a, b) => b.score - a.score || a.time - b.time || a.last.localeCompare(b.last));
    },
  });
