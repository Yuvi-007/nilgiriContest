import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Code2, Maximize, Play, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNow } from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { runCodingTests } from "@/lib/judge.functions";
import { contestQuery, contestQuestionsQuery } from "@/lib/queries";
import { contestStatus, hms } from "@/lib/time";
import { useAntiCheat } from "@/hooks/use-anti-cheat";

export const Route = createFileRoute("/_authenticated/_student/contest/$id/arena")({
  head: () => ({ meta: [{ title: "Arena — nilgiriContest" }] }),
  ssr: false,
  component: Arena,
});

function Arena() {
  const { id } = Route.useParams();
  const { authInfo } = Route.useRouteContext();
  const navigate = useNavigate();
  const { data: c } = useQuery(contestQuery(id));
  const { data: questionRows = [], isLoading: questionsLoading } = useQuery(
    contestQuestionsQuery(id),
  );
  const runCode = useServerFn(runCodingTests);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const now = useNow() ?? startedAt;
  const [deadline, setDeadline] = useState<number | null>(null);
  const [current, setCurrent] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [runningCode, setRunningCode] = useState(false);
  const [codeRun, setCodeRun] = useState<{
    questionId: string;
    passedTests: number;
    totalTests: number;
    score: number;
    error?: string;
  } | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem(`nilgiri-attempt-${id}`) ?? "{}") as Record<
        string,
        string
      >;
    } catch {
      return {};
    }
  });
  const questions = useMemo(() => questionRows.map((row) => row.question), [questionRows]);
  const question = questions[current];
  const options = Array.isArray(question?.options)
    ? question.options.filter((option): option is string => typeof option === "string")
    : [];
  const answered = Object.values(answers).filter((answer) => answer.trim()).length;
  const violations = useAntiCheat(id, !submitted);

  useEffect(() => {
    let active = true;
    supabase.rpc("start_contest_attempt_v2", { _contest_id: id }).then(({ data, error }) => {
      if (!active) return;
      if (error) setSubmissionError("Unable to start this attempt. Please return to the lobby.");
      else if (data && typeof data === "object" && !Array.isArray(data)) {
        const payload = data as {
          attemptId?: string;
          startedAt?: string;
          deadline?: string;
          answers?: unknown;
        };
        if (payload.attemptId) setAttemptId(payload.attemptId);
        if (payload.startedAt) setStartedAt(new Date(payload.startedAt).getTime());
        if (payload.deadline) setDeadline(new Date(payload.deadline).getTime());
        if (
          payload.answers &&
          typeof payload.answers === "object" &&
          !Array.isArray(payload.answers)
        )
          setAnswers(payload.answers as Record<string, string>);
      }
    });
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (!attemptId || submitted) return;
    const save = () => {
      void supabase.rpc("save_attempt_answers", {
        _attempt_id: attemptId,
        _answers: answers,
        _violations: { count: violations },
      });
    };
    save();
    const interval = window.setInterval(save, 20_000);
    return () => window.clearInterval(interval);
  }, [answers, attemptId, submitted, violations]);

  useEffect(() => {
    const sendHeartbeat = () => {
      void supabase.rpc("student_contest_heartbeat", {
        _contest_id: id,
        _status: submitted ? "submitted" : "active",
        _violations: violations,
      });
    };
    sendHeartbeat();
    const interval = window.setInterval(sendHeartbeat, 15_000);
    return () => window.clearInterval(interval);
  }, [id, submitted, violations]);

  useEffect(() => {
    localStorage.setItem(`nilgiri-attempt-${id}`, JSON.stringify(answers));
  }, [answers, id]);

  function setAnswer(value: string) {
    if (!question) return;
    setAnswers((currentAnswers) => ({ ...currentAnswers, [question.id]: value }));
  }

  async function enterFullscreen() {
    await document.documentElement.requestFullscreen?.();
  }

  async function runTests() {
    if (!question || question.type !== "coding" || runningCode) return;
    setRunningCode(true);
    setCodeRun(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Your session has expired.");
      const result = await runCode({
        data: {
          contestId: id,
          questionId: question.id,
          sourceCode: answers[question.id] ?? "",
          accessToken,
        },
      });
      setCodeRun({ questionId: question.id, ...result });
    } catch (error) {
      setCodeRun({
        questionId: question.id,
        passedTests: 0,
        totalTests: 0,
        score: 0,
        error: error instanceof Error ? error.message : "The coding judge failed.",
      });
    } finally {
      setRunningCode(false);
    }
  }

  const submitAttempt = useCallback(async () => {
    if (submitting || submitted) return;
    setSubmitting(true);
    setSubmissionError(null);
    const { error } = await supabase.rpc("submit_contest_attempt", {
      _contest_id: id,
      _answers: answers,
      _violations: violations,
    });
    if (error) {
      setSubmissionError("Your attempt could not be submitted. Please try again.");
      setSubmitting(false);
      return;
    }
    setSubmitted(true);
    localStorage.setItem(`nilgiri-attempt-${id}-submitted`, String(Date.now()));
  }, [answers, id, submitted, submitting, violations]);

  useEffect(() => {
    if (deadline !== null && deadline <= now && !submitted && !submitting) void submitAttempt();
  }, [deadline, now, submitted, submitting, submitAttempt]);

  if (c && contestStatus(c, now) !== "live") {
    return (
      <div className="calm min-h-screen bg-background p-8 text-center">
        <h1 className="text-2xl font-bold">This contest is not live.</h1>
        <Link to="/contest/$id/lobby" params={{ id }} className="mt-4 inline-block text-cyan">
          Return to lobby
        </Link>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="calm min-h-screen bg-background p-8">
        <div className="mx-auto mt-20 max-w-lg glass rounded-2xl p-8 text-center">
          <Check className="mx-auto h-10 w-10 text-green" />
          <h1 className="mt-4 text-2xl font-bold">Attempt submitted</h1>
          <p className="mt-2 text-muted-foreground">
            Your answers were submitted securely. Results will be available after the contest
            closes.
          </p>
          <Button
            className="mt-6"
            onClick={() => navigate({ to: "/contest/$id/lobby", params: { id } })}
          >
            Return to lobby
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="calm min-h-screen bg-background">
      <div className="sticky top-0 z-40 flex h-11 items-center gap-4 border-b border-border bg-bg2 px-4 text-sm">
        <span className="font-extrabold">
          nilgiri<span className="text-primary">Contest</span>
        </span>
        <span className="truncate text-muted-foreground">{c?.title ?? "…"}</span>
        <span className="ml-auto font-mono text-muted-foreground">{authInfo.loginId}</span>
        <span className="rounded-md bg-bg3 px-2 py-0.5 font-mono text-cyan">
          {deadline ? hms(deadline - now) : "--:--:--"}
        </span>
        <Button size="sm" variant="secondary" className="h-7" onClick={enterFullscreen}>
          <Maximize className="h-3.5 w-3.5" /> Focus
        </Button>
      </div>
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[220px_1fr]">
        <aside className="glass h-fit rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>
              {answered}/{questions.length}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2 lg:grid-cols-2">
            {questions.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setCurrent(index)}
                className={`rounded-md border p-2 text-left text-xs ${index === current ? "border-cyan bg-cyan/10 text-foreground" : "border-border text-muted-foreground"}`}
              >
                <span className="font-mono">Q{index + 1}</span>
                {answers[item.id] && <Check className="float-right h-3.5 w-3.5 text-green" />}
              </button>
            ))}
          </div>
          <p className="mt-5 text-xs text-muted-foreground">
            {violations} recorded violation{violations === 1 ? "" : "s"}
          </p>
        </aside>
        <main className="glass rounded-2xl p-6 sm:p-8">
          {questionsLoading ? (
            <p className="text-muted-foreground">Loading questions...</p>
          ) : !question ? (
            <p className="text-muted-foreground">No questions are assigned to this contest.</p>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <p className="font-mono text-xs uppercase text-cyan">
                    Question {current + 1} of {questions.length}
                  </p>
                  <h1 className="mt-2 text-2xl font-bold">{question.title}</h1>
                </div>
                <span className="font-mono text-sm text-gold">
                  {question.marks} mark{question.marks === 1 ? "" : "s"}
                </span>
              </div>
              <p className="mt-6 whitespace-pre-wrap leading-relaxed text-muted-foreground">
                {question.body}
              </p>
              {question.type === "mcq" ? (
                <div className="mt-6 grid gap-3">
                  {options.map((option, index) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setAnswer(String(index))}
                      className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-colors ${answers[question.id] === String(index) ? "border-green/60 bg-green/10" : "border-border bg-bg3 hover:border-cyan/50"}`}
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-current font-mono text-xs">
                        {String.fromCharCode(65 + index)}
                      </span>
                      {option}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5 font-mono uppercase">
                      <Code2 className="h-3.5 w-3.5 text-cyan" /> Python
                    </span>
                    <span>Configured server tests</span>
                  </div>
                  <textarea
                    value={answers[question.id] ?? ""}
                    onChange={(event) => setAnswer(event.target.value)}
                    className="min-h-64 w-full rounded-lg border border-border bg-bg3 p-4 font-mono text-sm outline-none focus:border-cyan"
                    placeholder="Write Python code that reads stdin and writes stdout..."
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void runTests()}
                      disabled={runningCode || !answers[question.id]?.trim()}
                    >
                      <Play className="h-4 w-4" /> {runningCode ? "Running..." : "Run tests"}
                    </Button>
                    {codeRun?.questionId === question.id && !codeRun.error && (
                      <span className="text-sm text-muted-foreground">
                        {codeRun.passedTests}/{codeRun.totalTests} tests passed · {codeRun.score}/
                        {question.marks} marks
                      </span>
                    )}
                    {codeRun?.questionId === question.id && codeRun.error && (
                      <span className="text-sm text-destructive">{codeRun.error}</span>
                    )}
                  </div>
                </div>
              )}
              <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
                <Button
                  variant="secondary"
                  disabled={current === 0}
                  onClick={() => setCurrent((value) => value - 1)}
                >
                  Previous
                </Button>
                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    disabled={current === questions.length - 1}
                    onClick={() => setCurrent((value) => value + 1)}
                  >
                    Next
                  </Button>
                  {submissionError && (
                    <p className="basis-full text-sm text-destructive">{submissionError}</p>
                  )}
                  <Button onClick={() => void submitAttempt()} disabled={submitting}>
                    <Send className="h-4 w-4" /> Submit
                  </Button>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
