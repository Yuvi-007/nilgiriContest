import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Code2, Maximize, Play, Send, Shield, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNow } from "@/lib/useNow";
import { supabase } from "@/integrations/supabase/client";
import { runCodingTests } from "@/lib/judge.functions";
import { contestQuery, contestQuestionsQuery, studentAttemptStatusQuery } from "@/lib/queries";
import { contestStatus, hms } from "@/lib/time";
import { useAntiCheat } from "@/hooks/use-anti-cheat";
import { AntiCheatModal } from "@/components/AntiCheatModal";

export const Route = createFileRoute("/_authenticated/_student/contest/$id/arena")({
  head: () => ({ meta: [{ title: "Arena — nilgiriContest" }] }),
  ssr: false,
  component: Arena,
});

function Arena() {
  const { id } = Route.useParams();
  const { authInfo } = Route.useRouteContext();
  const navigate = useNavigate();

  // Queries
  const { data: c } = useQuery(contestQuery(id));
  const { data: attemptStatus, isLoading: statusLoading } = useQuery(studentAttemptStatusQuery(id));
  const {
    data: questionRows = [],
    isLoading: questionsLoading,
    error: questionsError,
  } = useQuery(contestQuestionsQuery(id));

  const runCode = useServerFn(runCodingTests);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [assignedSet, setAssignedSet] = useState<string | null>(null);
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
  const activeSet = assignedSet || questions[0]?.set_code || "A";
  const options = Array.isArray(question?.options)
    ? question.options.filter((option): option is string => typeof option === "string")
    : [];
  const answered = Object.values(answers).filter((answer) => answer.trim()).length;

  // Single-attempt check: If already submitted in DB or localStorage
  useEffect(() => {
    if (attemptStatus?.is_submitted || attemptStatus?.status === "submitted") {
      setSubmitted(true);
      localStorage.removeItem(`nilgiri-attempt-${id}`);
    }
  }, [attemptStatus, id]);

  const antiCheatRef = useRef<ReturnType<typeof useAntiCheat> | null>(null);

  // Hardened Anti-Cheat proctoring hook with 3-strikes auto-submit
  const antiCheat = useAntiCheat({
    contestId: id,
    enabled: !submitted && !submitting,
    onAutoSubmit: () => {
      void submitAttempt();
    },
  });

  antiCheatRef.current = antiCheat;

  const submitAttempt = useCallback(async () => {
    if (submitting || submitted) return;
    setSubmitting(true);
    setSubmissionError(null);
    const { error } = await supabase.rpc("submit_contest_attempt", {
      _contest_id: id,
      _answers: answers,
      _violations: antiCheatRef.current?.violations ?? 0,
    });
    if (error) {
      setSubmissionError("Your attempt could not be submitted. Please try again.");
      setSubmitting(false);
      return;
    }
    setSubmitted(true);
    localStorage.removeItem(`nilgiri-attempt-${id}`);
    localStorage.setItem(`nilgiri-attempt-${id}-submitted`, String(Date.now()));
  }, [answers, id, submitted, submitting]);

  useEffect(() => {
    let active = true;
    supabase.rpc("start_contest_attempt_v2", { _contest_id: id }).then(({ data, error }) => {
      if (!active) return;
      if (error) {
        if (error.message?.includes("already submitted")) {
          setSubmitted(true);
          localStorage.removeItem(`nilgiri-attempt-${id}`);
        } else {
          setSubmissionError("Unable to start this attempt. Please return to the lobby.");
        }
      } else if (data && typeof data === "object" && !Array.isArray(data)) {
        const payload = data as {
          attemptId?: string;
          assignedSet?: string;
          startedAt?: string;
          deadline?: string;
          answers?: unknown;
        };
        if (payload.attemptId) setAttemptId(payload.attemptId);
        if (payload.assignedSet) setAssignedSet(payload.assignedSet);
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
        _violations: { count: antiCheat.violations, strikes: antiCheat.strikes },
      });
    };
    save();
    const interval = window.setInterval(save, 20_000);
    return () => window.clearInterval(interval);
  }, [answers, attemptId, submitted, antiCheat.violations, antiCheat.strikes]);

  useEffect(() => {
    const sendHeartbeat = () => {
      void supabase.rpc("student_contest_heartbeat", {
        _contest_id: id,
        _status: submitted ? "submitted" : "active",
        _violations: antiCheat.violations,
      });
    };
    sendHeartbeat();
    const interval = window.setInterval(sendHeartbeat, 15_000);
    return () => window.clearInterval(interval);
  }, [id, submitted, antiCheat.violations]);

  useEffect(() => {
    if (!submitted) {
      localStorage.setItem(`nilgiri-attempt-${id}`, JSON.stringify(answers));
    }
  }, [answers, id, submitted]);

  function setAnswer(value: string) {
    if (!question || submitted) return;
    setAnswers((currentAnswers) => ({ ...currentAnswers, [question.id]: value }));
  }

  async function enterFullscreen() {
    await antiCheat.reenterFullscreen();
  }

  async function runTests() {
    if (!question || question.type !== "coding" || runningCode || submitted) return;
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

  useEffect(() => {
    if (deadline !== null && deadline <= now && !submitted && !submitting) void submitAttempt();
  }, [deadline, now, submitted, submitting, submitAttempt]);

  if (c && contestStatus(c, now) !== "live" && !submitted) {
    return (
      <div className="calm min-h-screen bg-background p-8 text-center">
        <h1 className="text-2xl font-bold">This contest is not live.</h1>
        <Link to="/contest/$id/lobby" params={{ id }} className="mt-4 inline-block text-cyan">
          Return to lobby
        </Link>
      </div>
    );
  }

  // Already submitted / finished state (Single-attempt enforcement)
  if (submitted || attemptStatus?.is_submitted) {
    return (
      <div className="calm min-h-screen bg-background p-8">
        <div className="mx-auto mt-20 max-w-lg glass rounded-2xl p-8 text-center border border-green/30 shadow-2xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-green/20 text-green">
            <Check className="h-8 w-8" />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold text-foreground">Contest Submitted</h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            Your attempt was securely recorded and finalized. Each student may only sit this
            examination once.
          </p>
          <div className="mt-4 rounded-xl border border-border/60 bg-bg3/60 p-3 font-mono text-xs text-muted-foreground">
            Status: Finalized · No further attempts allowed
          </div>
          <Button
            className="mt-6 w-full"
            onClick={() => navigate({ to: "/contest/$id/lobby", params: { id } })}
          >
            Return to lobby
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="calm min-h-screen bg-background select-none secure-exam-lock"
      onDragStart={(e) => e.preventDefault()}
    >
      {/* Anti-cheat modal & fullscreen recovery overlay */}
      <AntiCheatModal
        warning={antiCheat.activeWarning}
        onDismiss={antiCheat.dismissWarning}
        isFullscreen={antiCheat.isFullscreen}
        onReenterFullscreen={() => void enterFullscreen()}
        isWindowFocused={antiCheat.isWindowFocused}
      />

      {/* Top bar */}
      <div className="sticky top-0 z-30 flex h-11 items-center gap-3 border-b border-border bg-bg2/90 backdrop-blur-md px-4 text-sm">
        <span className="font-extrabold tracking-tight">
          nilgiri<span className="text-primary">Contest</span>
        </span>
        <span className="hidden truncate text-muted-foreground sm:inline">{c?.title ?? "…"}</span>

        {/* Security badge and assigned set */}
        <div className="flex items-center gap-1.5 ml-2">
          <span className="flex items-center gap-1 rounded-full border border-cyan/40 bg-cyan/15 px-2.5 py-0.5 font-mono text-xs font-bold text-cyan">
            Set {activeSet}
          </span>
          {antiCheat.strikes > 0 ? (
            <span className="flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/15 px-2.5 py-0.5 font-mono text-xs font-bold text-destructive animate-pulse">
              <ShieldAlert className="h-3 w-3" />
              Strikes {antiCheat.strikes}/{antiCheat.maxStrikes}
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-full border border-green/30 bg-green/10 px-2 py-0.5 text-xs font-medium text-green">
              <Shield className="h-3 w-3" />
              Proctored
            </span>
          )}
        </div>

        <span className="ml-auto font-mono text-xs text-muted-foreground">{authInfo.loginId}</span>
        <span className="rounded-md bg-bg3 px-2 py-0.5 font-mono text-xs text-cyan font-bold">
          {deadline ? hms(deadline - now) : "--:--:--"}
        </span>
        <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={enterFullscreen}>
          <Maximize className="h-3.5 w-3.5" /> Fullscreen
        </Button>
      </div>

      {/* Main layout */}
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[220px_1fr]">
        {/* Navigation Sidebar */}
        <aside className="glass h-fit rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span className="font-mono">
              {answered}/{questions.length}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2 lg:grid-cols-2">
            {questions.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setCurrent(index)}
                className={`rounded-lg border p-2 text-left text-xs transition-colors ${
                  index === current
                    ? "border-cyan bg-cyan/10 text-foreground font-semibold"
                    : "border-border text-muted-foreground hover:bg-accent/40"
                }`}
              >
                <span className="font-mono">Q{index + 1}</span>
                {answers[item.id] && <Check className="float-right h-3.5 w-3.5 text-green" />}
              </button>
            ))}
          </div>

          <div className="mt-5 rounded-xl border border-border/60 bg-bg3/50 p-2.5 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Violations:</span>
              <span className="font-mono font-bold text-foreground">{antiCheat.violations}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span>Strikes:</span>
              <span
                className={`font-mono font-bold ${
                  antiCheat.strikes > 0 ? "text-destructive" : "text-green"
                }`}
              >
                {antiCheat.strikes}/{antiCheat.maxStrikes}
              </span>
            </div>
          </div>

          <Button
            className="mt-4 w-full gap-1.5 font-bold"
            disabled={submitting}
            onClick={() => {
              if (
                window.confirm(
                  "Are you sure you want to finish and submit your contest? This cannot be undone.",
                )
              ) {
                void submitAttempt();
              }
            }}
          >
            <Send className="h-3.5 w-3.5" /> Submit Exam
          </Button>
        </aside>

        {/* Question & Workspace Area */}
        <main className="glass rounded-2xl p-6 sm:p-8">
          {questionsLoading ? (
            <p className="text-muted-foreground">Loading questions securely...</p>
          ) : questionsError ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-center">
              <p className="text-sm font-semibold text-destructive">Questions Locked</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {(questionsError as Error).message ?? "Unable to load questions."}
              </p>
            </div>
          ) : !question ? (
            <p className="text-muted-foreground">No questions are assigned to this contest.</p>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-cyan/15 px-2 py-0.5 font-mono text-xs font-extrabold text-cyan">
                      SET {activeSet}
                    </span>
                    <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground font-bold">
                      Question {current + 1} of {questions.length} · {question.type.toUpperCase()}
                      {question.difficulty && ` · ${question.difficulty.toUpperCase()}`}
                    </p>
                  </div>
                  <h1 className="mt-2 text-2xl font-extrabold select-none">{question.title}</h1>
                </div>
                <span className="rounded-full bg-gold/15 px-3 py-1 font-mono text-xs font-bold text-gold">
                  {question.marks} mark{question.marks === 1 ? "" : "s"}
                </span>
              </div>

              {/* Question Image if present */}
              {question.image_url && (
                <div className="mt-5 overflow-hidden rounded-xl border border-border/80 bg-bg3/60 p-3 select-none">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-2 px-1">
                    <span className="font-mono">Reference Diagram / Problem Attachment</span>
                    <span className="text-[10px] uppercase tracking-wider text-cyan/70 font-semibold">
                      Protected Asset
                    </span>
                  </div>
                  <div className="flex justify-center bg-black/40 rounded-lg p-2 border border-border/40">
                    <img
                      src={question.image_url}
                      alt={question.title}
                      className="max-h-80 w-auto max-w-full rounded-md object-contain select-none pointer-events-none"
                      onContextMenu={(e) => e.preventDefault()}
                      draggable={false}
                    />
                  </div>
                </div>
              )}

              {/* Unselectable question body */}
              <p className="mt-6 whitespace-pre-wrap leading-relaxed text-foreground/90 select-none">
                {question.body}
              </p>

              {question.type === "mcq" ? (
                <div className="mt-6 grid gap-3 select-none">
                  {options.map((option, index) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setAnswer(String(index))}
                      className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all ${
                        answers[question.id] === String(index)
                          ? "border-green bg-green/10 shadow-sm"
                          : "border-border bg-bg3 hover:border-cyan/40 hover:bg-accent/30"
                      }`}
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-current font-mono text-xs font-bold">
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span className="text-sm">{option}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5 font-mono uppercase font-semibold">
                      <Code2 className="h-3.5 w-3.5 text-cyan" /> Python 3
                    </span>
                    <span className="text-muted-foreground/80">Copy &amp; Paste disabled</span>
                  </div>
                  <textarea
                    rows={12}
                    value={answers[question.id] ?? ""}
                    onChange={(event) => setAnswer(event.target.value)}
                    placeholder="# Write your Python solution here... (Note: pasting external code is restricted)"
                    className="w-full rounded-xl border border-border bg-black/60 p-4 font-mono text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/40 focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan"
                    spellCheck={false}
                  />
                  <div className="flex items-center justify-between pt-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={runningCode}
                      onClick={() => void runTests()}
                      className="gap-2 font-semibold"
                    >
                      <Play className="h-3.5 w-3.5" />
                      {runningCode ? "Testing code..." : "Run tests"}
                    </Button>
                    {codeRun?.questionId === question.id && (
                      <span
                        className={`font-mono text-xs font-bold ${
                          codeRun.passedTests === codeRun.totalTests ? "text-green" : "text-gold"
                        }`}
                      >
                        {codeRun.passedTests}/{codeRun.totalTests} tests passed (
                        {codeRun.score.toFixed(1)} marks)
                      </span>
                    )}
                  </div>
                  {codeRun?.questionId === question.id && codeRun.error && (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 font-mono text-xs text-destructive">
                      {codeRun.error}
                    </div>
                  )}
                </div>
              )}

              {/* Navigation pagination */}
              <div className="mt-8 flex items-center justify-between border-t border-border pt-4">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={current === 0}
                  onClick={() => setCurrent((c) => Math.max(0, c - 1))}
                >
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground">
                  {current + 1} of {questions.length}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={current === questions.length - 1}
                  onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
