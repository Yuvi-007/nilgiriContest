import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  CircleAlert,
  Maximize2,
  Shield,
  ShieldAlert,
  Lock,
  Check,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Page, GlassCard, StatusPill } from "@/components/ui-kit";
import { useNow } from "@/lib/useNow";
import { contestQuery, studentAttemptStatusQuery } from "@/lib/queries";
import { contestStatus, formatIST, hms } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/_student/contest/$id/lobby")({
  head: () => ({ meta: [{ title: "Contest lobby — nilgiriContest" }] }),
  ssr: false,
  component: Lobby,
});

function Lobby() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: c, isLoading } = useQuery(contestQuery(id));
  const { data: attemptStatus, isLoading: statusLoading } = useQuery(studentAttemptStatusQuery(id));

  const [fullscreen, setFullscreen] = useState(false);
  const [online, setOnline] = useState(true);
  const [secure, setSecure] = useState(true);
  const [hardware, setHardware] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const now = useNow() ?? Date.now();

  useEffect(() => {
    setOnline(navigator.onLine);
    setSecure(window.isSecureContext);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const onFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("fullscreenchange", onFullscreen);
    void navigator.mediaDevices
      ?.enumerateDevices()
      .then((devices) => {
        setHardware(
          Boolean(navigator.mediaDevices) &&
            devices.some((device) => device.kind === "videoinput" || device.kind === "audioinput"),
        );
      })
      .catch(() => setHardware(false));
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("fullscreenchange", onFullscreen);
    };
  }, []);

  async function enterFullscreen() {
    await document.documentElement.requestFullscreen?.();
  }

  if (isLoading || statusLoading) {
    return (
      <Page calm>
        <p className="text-muted-foreground">Loading contest details...</p>
      </Page>
    );
  }

  if (!c) {
    return (
      <Page calm>
        <p>Contest not found.</p>
      </Page>
    );
  }

  const status = contestStatus(c, now);
  const isSubmitted =
    attemptStatus?.is_submitted ||
    attemptStatus?.status === "submitted" ||
    Boolean(localStorage.getItem(`nilgiri-attempt-${id}-submitted`));
  const isInProgress = attemptStatus?.status === "in_progress" && !isSubmitted;

  const ready = fullscreen && online && secure && hardware && agreed;
  const remainingWindow = new Date(c.end_time).getTime() - now;
  const effective = Math.min(c.duration_minutes * 60_000, Math.max(0, remainingWindow));

  return (
    <Page calm>
      <div className="mx-auto max-w-2xl space-y-4">
        {/* Contest Header Card */}
        <GlassCard className="p-8">
          <div className="flex items-center justify-between">
            <StatusPill status={status} />
            <span className="flex items-center gap-1.5 rounded-full border border-green/30 bg-green/10 px-3 py-1 font-mono text-xs text-green">
              <Shield className="h-3.5 w-3.5" /> High Security Proctoring
            </span>
          </div>

          <h1 className="mt-4 text-3xl font-extrabold tracking-tight">{c.title}</h1>
          <p className="mt-2 text-muted-foreground leading-relaxed">{c.description}</p>

          <dl className="mt-6 grid grid-cols-2 gap-4 font-mono text-sm">
            <div>
              <dt className="text-muted-foreground">Opens</dt>
              <dd className="font-semibold">{formatIST(c.start_time)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Closes</dt>
              <dd className="font-semibold">{formatIST(c.end_time)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Time Limit</dt>
              <dd className="font-semibold">{Math.round(effective / 60000)} min</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Pattern</dt>
              <dd className="font-semibold">5 MCQ + 3 coding = 20 pts</dd>
            </div>
          </dl>
        </GlassCard>

        {/* 1. If contest is already completed by this student (Strict Single-Attempt Enforcement) */}
        {isSubmitted ? (
          <GlassCard className="border-green/30 bg-green/5 p-8 text-center shadow-lg">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-green/20 text-green">
              <Check className="h-8 w-8" />
            </div>
            <h2 className="mt-4 text-2xl font-bold text-foreground">Exam Attempt Completed</h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              You have already completed and submitted your examination for this contest. In
              accordance with examination regulations, only one attempt is permitted per student.
            </p>

            <div className="mt-5 rounded-xl border border-border/70 bg-bg3/60 p-4 text-left font-mono text-xs space-y-1.5 text-muted-foreground">
              <div className="flex justify-between">
                <span>Attempt Status:</span>
                <span className="text-green font-bold uppercase">Submitted &amp; Locked</span>
              </div>
              {attemptStatus?.submitted_at && (
                <div className="flex justify-between">
                  <span>Submitted At:</span>
                  <span>{formatIST(attemptStatus.submitted_at)}</span>
                </div>
              )}
              {attemptStatus?.violations !== undefined && (
                <div className="flex justify-between">
                  <span>Recorded Violations:</span>
                  <span>{attemptStatus.violations}</span>
                </div>
              )}
            </div>

            {status === "closed" ? (
              <div className="mt-6">
                <Link to="/contest/$id/result" params={{ id }}>
                  <Button size="lg" className="w-full font-bold">
                    View Official Results &amp; Solutions
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-border/50 bg-bg2/80 p-3.5 text-xs text-muted-foreground">
                <Lock className="inline h-3.5 w-3.5 mr-1 text-gold" />
                Contest is currently active. Official rankings and solutions will be unlocked after
                the contest window closes at{" "}
                <span className="font-semibold text-foreground">{formatIST(c.end_time)}</span>.
              </div>
            )}
          </GlassCard>
        ) : (
          /* 2. Pre-exam Rules and Hardware / Environment Checklist */
          <>
            <GlassCard>
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-gold" />
                <h2 className="font-bold text-base">Examination Security Rules</h2>
              </div>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                <li>
                  <strong className="text-foreground">Single attempt:</strong> Once entered and
                  submitted, you cannot retake this contest.
                </li>
                <li>
                  <strong className="text-foreground">Zero-tolerance window blur:</strong> Switching
                  tabs, clicking background windows, or accessing secondary monitors counts as a
                  security strike.
                </li>
                <li>
                  <strong className="text-foreground">3 Strikes rule:</strong> Reaching 3 strikes
                  triggers automatic submission and disqualification.
                </li>
                <li>
                  <strong className="text-foreground">Clipboard lockdown:</strong> Copying
                  questions, pasting external text, and right-clicking are strictly disabled.
                </li>
                <li>
                  <strong className="text-foreground">Timer continuity:</strong> The timer begins
                  the moment you enter and cannot be paused.
                </li>
              </ul>

              <div className="mt-6 space-y-2.5 border-t border-border pt-4 text-sm">
                <CheckItem label="Browser is running in a secure HTTPS context" ok={secure} />
                <CheckItem label="Network connection is stable and online" ok={online} />
                <CheckItem label="Hardware peripherals detected (camera/mic)" ok={hardware} />

                <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-bg3 p-3">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {fullscreen ? (
                      <CheckCircle2 className="h-4 w-4 text-green" />
                    ) : (
                      <CircleAlert className="h-4 w-4 text-gold" />
                    )}{" "}
                    Fullscreen environment
                  </span>
                  {!fullscreen && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => void enterFullscreen()}
                      className="gap-1.5"
                    >
                      <Maximize2 className="h-3.5 w-3.5" /> Enter fullscreen
                    </Button>
                  )}
                </div>

                <label className="flex items-start gap-3 rounded-xl border border-border bg-bg3 p-3 cursor-pointer hover:border-border/80 transition-colors">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(event) => setAgreed(event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-xs text-muted-foreground leading-relaxed">
                    I understand that proctoring is enabled, questions cannot be copied, and any tab
                    switch or window blur will be recorded as a violation toward the 3-strike limit.
                  </span>
                </label>
              </div>
            </GlassCard>

            {status === "scheduled" && (
              <GlassCard className="text-center py-6">
                <p className="font-mono text-sm text-muted-foreground">Contest starts in</p>
                <p className="mt-1 font-mono text-2xl font-bold text-cyan">
                  {hms(new Date(c.start_time).getTime() - now)}
                </p>
              </GlassCard>
            )}

            {status === "live" && (
              <Button
                size="lg"
                className="w-full font-bold text-base shadow-glow"
                disabled={!ready}
                onClick={() => navigate({ to: "/contest/$id/arena", params: { id } })}
              >
                {isInProgress ? "Resume Contest" : "Start Contest"}
              </Button>
            )}

            {status === "closed" && (
              <Link to="/contest/$id/result" params={{ id }}>
                <Button className="w-full font-bold" variant="secondary" size="lg">
                  View Results
                </Button>
              </Link>
            )}
          </>
        )}
      </div>
    </Page>
  );
}

function CheckItem({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border bg-bg3 p-3 text-sm">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-green shrink-0" />
      ) : (
        <CircleAlert className="h-4 w-4 text-gold shrink-0" />
      )}
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}
