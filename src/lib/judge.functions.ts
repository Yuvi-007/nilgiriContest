import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const MAX_RUNS_PER_ATTEMPT = 10;
const DEFAULT_PYTHON_LANGUAGE_ID = 71;

const testCaseSchema = z.object({
  input: z.string(),
  expected_output: z.string(),
});

export const runCodingTests = createServerFn({ method: "POST" })
  .inputValidator((value) =>
    z
      .object({
        contestId: z.string().uuid(),
        questionId: z.string().uuid(),
        sourceCode: z.string().min(1).max(50_000),
        accessToken: z.string().min(1),
      })
      .parse(value),
  )
  .handler(async ({ data }) => {
    const url = process.env["SUPABASE_URL"];
    const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
    const judgeUrl = process.env["JUDGE0_URL"];
    const judgeToken = process.env["JUDGE0_AUTH_TOKEN"];
    if (!url || !publishableKey) throw new Error("Supabase is not configured.");
    if (!judgeUrl) throw new Error("Coding judge is not configured yet.");

    const sessionClient = createClient<Database>(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await sessionClient.auth.getUser(data.accessToken);
    if (userError || !userData.user) throw new Error("Your session has expired.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: role }, { data: contest }, { data: question }, { data: attempt }] =
      await Promise.all([
        supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", userData.user.id)
          .eq("role", "student")
          .maybeSingle(),
        supabaseAdmin
          .from("contests")
          .select("id,is_draft,start_time,end_time")
          .eq("id", data.contestId)
          .maybeSingle(),
        supabaseAdmin
          .from("questions")
          .select("id,type,marks,code_language,test_cases")
          .eq("id", data.questionId)
          .maybeSingle(),
        supabaseAdmin
          .from("contest_attempts")
          .select("submitted_at")
          .eq("contest_id", data.contestId)
          .eq("user_id", userData.user.id)
          .maybeSingle(),
      ]);

    if (!role || !contest || contest.is_draft || !question || question.type !== "coding") {
      throw new Error("This coding question is unavailable.");
    }
    const now = Date.now();
    if (
      new Date(contest.start_time).getTime() > now ||
      new Date(contest.end_time).getTime() <= now
    ) {
      throw new Error("The contest is not live.");
    }
    if (!attempt || attempt.submitted_at) throw new Error("This attempt is not available.");

    const { count } = await supabaseAdmin
      .from("coding_submissions")
      .select("id", { count: "exact", head: true })
      .eq("contest_id", data.contestId)
      .eq("user_id", userData.user.id);
    if ((count ?? 0) >= MAX_RUNS_PER_ATTEMPT)
      throw new Error("Run limit reached for this attempt.");

    const testCases = z.array(testCaseSchema).parse(question.test_cases ?? []);
    if (!testCases.length) throw new Error("This question has no test cases configured.");
    if (question.code_language !== "python") throw new Error("Only Python is enabled for now.");

    const headers = new Headers({ "Content-Type": "application/json" });
    if (judgeToken) headers.set("X-Auth-Token", judgeToken);
    const results: Array<{ stdout: string; stderr: string; passed: boolean; status: string }> = [];

    for (const testCase of testCases) {
      const response = await fetch(
        `${judgeUrl.replace(/\/$/, "")}/submissions?wait=true&base64_encoded=false`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            source_code: data.sourceCode,
            language_id: DEFAULT_PYTHON_LANGUAGE_ID,
            stdin: testCase.input,
            expected_output: testCase.expected_output,
          }),
        },
      );
      if (!response.ok) throw new Error("The coding judge could not be reached.");
      const result = (await response.json()) as {
        stdout?: string | null;
        stderr?: string | null;
        compile_output?: string | null;
        status?: { description?: string };
      };
      const stdout = result.stdout ?? "";
      const stderr = result.stderr ?? result.compile_output ?? "";
      const status = result.status?.description ?? "Unknown";
      results.push({
        stdout,
        stderr,
        status,
        passed: status === "Accepted" && normalize(stdout) === normalize(testCase.expected_output),
      });
    }

    const passedTests = results.filter((result) => result.passed).length;
    const score = Number(((question.marks * passedTests) / testCases.length).toFixed(2));
    await supabaseAdmin.from("coding_submissions").insert({
      contest_id: data.contestId,
      user_id: userData.user.id,
      question_id: data.questionId,
      source_code: data.sourceCode,
      language_id: DEFAULT_PYTHON_LANGUAGE_ID,
      status: passedTests === testCases.length ? "accepted" : "failed",
      passed_tests: passedTests,
      total_tests: testCases.length,
      score,
      stdout: results.map((result) => result.stdout).join("\n---\n"),
      stderr:
        results
          .map((result) => result.stderr)
          .filter(Boolean)
          .join("\n---\n") || null,
    });

    return { passedTests, totalTests: testCases.length, score, results };
  });

function normalize(value: string) {
  return value.trim().replace(/\r\n/g, "\n");
}
