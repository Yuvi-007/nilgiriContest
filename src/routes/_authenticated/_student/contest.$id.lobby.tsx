import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, CircleAlert, Maximize2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Page, GlassCard, StatusPill } from "@/components/ui-kit";
import { useNow } from "@/components/Navbar";
import { contestQuery } from "@/lib/queries";
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
  if (isLoading)
    return (
      <Page calm>
        <p className="text-muted-foreground">Loading…</p>
      </Page>
    );
  if (!c)
    return (
      <Page calm>
        <p>Contest not found.</p>
      </Page>
    );
  const status = contestStatus(c, now);
  const ready = fullscreen && online && secure && hardware && agreed;
  const remainingWindow = new Date(c.end_time).getTime() - now;
  const effective = Math.min(c.duration_minutes * 60_000, Math.max(0, remainingWindow));

  return (
    <Page calm>
      <div className="mx-auto max-w-2xl space-y-4">
        <GlassCard className="p-8">
          <StatusPill status={status} />
          <h1 className="mt-3 text-3xl font-extrabold">{c.title}</h1>
          <p className="mt-2 text-muted-foreground">{c.description}</p>
          <dl className="mt-6 grid grid-cols-2 gap-4 font-mono text-sm">
            <div>
              <dt className="text-muted-foreground">Opens</dt>
              <dd>{formatIST(c.start_time)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Closes</dt>
              <dd>{formatIST(c.end_time)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Your time</dt>
              <dd>{Math.round(effective / 60000)} min</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Marks</dt>
              <dd>5 MCQ + 3 coding = 20</dd>
            </div>
          </dl>
        </GlassCard>
        <GlassCard>
          <h2 className="font-bold">Before you start</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>The timer starts the moment you enter and cannot be paused.</li>
            <li>Leaving fullscreen or switching tabs is recorded as a violation.</li>
            <li>Copy/paste is disabled in the arena.</li>
          </ul>
          <div className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
            <CheckItem label="Browser is running in a secure context" ok={secure} />
            <CheckItem label="Network connection is online" ok={online} />
            <CheckItem label="Camera or microphone is available" ok={hardware} />
            <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-bg3 p-3">
              <span className="flex items-center gap-2">
                {fullscreen ? (
                  <CheckCircle2 className="h-4 w-4 text-green" />
                ) : (
                  <CircleAlert className="h-4 w-4 text-gold" />
                )}{" "}
                Fullscreen focus
              </span>
              {!fullscreen && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => void enterFullscreen()}
                >
                  <Maximize2 className="h-3.5 w-3.5" /> Enter fullscreen
                </Button>
              )}
            </div>
            <label className="flex items-start gap-2 rounded-md border border-border bg-bg3 p-3">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(event) => setAgreed(event.target.checked)}
                className="mt-0.5"
              />
              <span className="text-sm">
                I agree to the contest rules and understand that the timer cannot be paused.
              </span>
            </label>
          </div>
        </GlassCard>
        {status === "scheduled" && (
          <p className="text-center font-mono">
            Starts in {hms(new Date(c.start_time).getTime() - now)}
          </p>
        )}
        {status === "live" && (
          <Button
            size="lg"
            className="w-full"
            disabled={!ready}
            onClick={() => navigate({ to: "/contest/$id/arena", params: { id } })}
          >
            Start contest
          </Button>
        )}
        {status === "closed" && (
          <Link to="/contest/$id/result" params={{ id }}>
            <Button className="w-full" variant="secondary">
              View result
            </Button>
          </Link>
        )}
      </div>
    </Page>
  );
}

function CheckItem({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-bg3 p-3">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-green" />
      ) : (
        <CircleAlert className="h-4 w-4 text-gold" />
      )}
      <span>{label}</span>
    </div>
  );
}
