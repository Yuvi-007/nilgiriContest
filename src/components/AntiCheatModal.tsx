import React from "react";
import { AlertTriangle, ShieldAlert, Maximize2, Lock, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AntiCheatWarning } from "@/hooks/use-anti-cheat";
import { MAX_STRIKES } from "@/hooks/use-anti-cheat";

interface AntiCheatModalProps {
  warning: AntiCheatWarning | null;
  onDismiss: () => void;
  isFullscreen: boolean;
  onReenterFullscreen: () => void;
  isWindowFocused: boolean;
}

export function AntiCheatModal({
  warning,
  onDismiss,
  isFullscreen,
  onReenterFullscreen,
  isWindowFocused,
}: AntiCheatModalProps) {
  // 1. If violation warning modal is triggered
  if (warning) {
    const isDisqualified = warning.strike >= MAX_STRIKES;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in fade-in duration-200">
        <div className="w-full max-w-md rounded-2xl border border-destructive/50 bg-card p-6 shadow-2xl">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                isDisqualified ? "bg-destructive/20 text-destructive" : "bg-gold/20 text-gold"
              }`}
            >
              {isDisqualified ? (
                <Lock className="h-6 w-6 animate-pulse" />
              ) : (
                <ShieldAlert className="h-6 w-6" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 font-mono text-xs font-bold uppercase tracking-wider ${
                    isDisqualified
                      ? "bg-destructive/20 text-destructive border border-destructive/40"
                      : "bg-gold/20 text-gold border border-gold/40"
                  }`}
                >
                  Strike {warning.strike} of {MAX_STRIKES}
                </span>
                <span className="text-xs text-muted-foreground">Proctored Security</span>
              </div>
              <h2 className="mt-1 text-lg font-bold text-foreground">{warning.title}</h2>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-border/60 bg-bg3/60 p-3.5 text-sm text-muted-foreground">
            <p className="leading-relaxed">{warning.message}</p>
            <p className="mt-2 text-xs font-mono text-muted-foreground/75">
              Incident logged to proctoring audit trail with timestamp.
            </p>
          </div>

          {isDisqualified ? (
            <div className="mt-5 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-center">
              <p className="text-sm font-semibold text-destructive">
                Violation Limit Exceeded.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Your test attempt has been automatically locked and submitted due to academic integrity policy.
              </p>
            </div>
          ) : (
            <div className="mt-6 flex flex-col gap-2">
              <Button
                variant={warning.strike >= 2 ? "destructive" : "default"}
                size="lg"
                className="w-full font-semibold"
                onClick={onDismiss}
              >
                I understand — Continue Exam
              </Button>
              <p className="text-center text-[11px] text-muted-foreground">
                {MAX_STRIKES - warning.strike} strike{MAX_STRIKES - warning.strike === 1 ? "" : "s"} remaining before automatic submission.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 2. If student leaves fullscreen during exam
  if (!isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-lg">
        <div className="w-full max-w-md rounded-2xl border border-gold/40 bg-card p-6 text-center shadow-2xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gold/20 text-gold">
            <Maximize2 className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-xl font-extrabold text-foreground">Fullscreen Required</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This examination requires an uninterrupted fullscreen environment. All background apps, secondary displays, and desktop interactions are restricted.
          </p>
          <Button
            size="lg"
            className="mt-6 w-full gap-2 font-bold"
            onClick={onReenterFullscreen}
          >
            <Maximize2 className="h-4 w-4" /> Return to Fullscreen
          </Button>
        </div>
      </div>
    );
  }

  // 3. If window focus is lost (clicking outside on secondary monitor or background window)
  if (!isWindowFocused) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="max-w-sm rounded-xl border border-destructive/40 bg-card p-5 text-center shadow-xl">
          <EyeOff className="mx-auto h-8 w-8 text-destructive animate-pulse" />
          <h3 className="mt-3 font-bold text-foreground">Exam Window Inactive</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Click anywhere on this screen to refocus your examination. Navigating away is monitored.
          </p>
        </div>
      </div>
    );
  }

  return null;
}
