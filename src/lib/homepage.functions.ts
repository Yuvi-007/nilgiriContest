import { createClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";
import type { Database } from "@/integrations/supabase/types";

export type HomepageLeader = {
  rank: number;
  name: string;
  score: number;
  timeTakenSeconds: number;
  submittedAt: string;
};

export type HomepageSnapshot = {
  activeStudents: number;
  contestsHeld: number;
  totalSubmissions: number;
  averageScore: number | null;
  activeContest: { id: string; title: string } | null;
  latestContest: {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    leaders: HomepageLeader[];
  } | null;
};

const emptySnapshot: HomepageSnapshot = {
  activeStudents: 0,
  contestsHeld: 0,
  totalSubmissions: 0,
  averageScore: null,
  activeContest: null,
  latestContest: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseSnapshot(value: unknown): HomepageSnapshot {
  if (!isRecord(value)) return emptySnapshot;
  const activeContestValue = value["activeContest"];
  const activeContest = isRecord(activeContestValue)
    ? {
        id: String(activeContestValue["id"] ?? ""),
        title: String(activeContestValue["title"] ?? ""),
      }
    : null;
  const latestValue = value["latestContest"];
  const latest = isRecord(latestValue) ? latestValue : null;
  const leadersValue = latest?.["leaders"];
  const leaders = Array.isArray(leadersValue)
    ? leadersValue.filter(isRecord).map((leader) => ({
        rank: Number(leader["rank"] ?? 0),
        name: String(leader["name"] ?? "Student"),
        score: Number(leader["score"] ?? 0),
        timeTakenSeconds: Number(leader["timeTakenSeconds"] ?? 0),
        submittedAt: String(leader["submittedAt"] ?? ""),
      }))
    : [];

  return {
    activeStudents: Number(value["activeStudents"] ?? 0),
    contestsHeld: Number(value["contestsHeld"] ?? 0),
    totalSubmissions: Number(value["totalSubmissions"] ?? 0),
    averageScore:
      value["averageScore"] === null || value["averageScore"] === undefined
        ? null
        : Number(value["averageScore"]),
    activeContest,
    latestContest: latest
      ? {
          id: String(latest["id"] ?? ""),
          title: String(latest["title"] ?? ""),
          startTime: String(latest["startTime"] ?? ""),
          endTime: String(latest["endTime"] ?? ""),
          leaders,
        }
      : null,
  };
}

export const getHomepageSnapshot = createServerFn({ method: "GET" }).handler(async () => {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const client = createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
  const { data, error } = await client.rpc("get_homepage_snapshot");
  if (error) throw new Error("Homepage data is temporarily unavailable.");
  return parseSnapshot(data);
});
