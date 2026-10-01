import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export const MAX_STRIKES = 3;

export type AntiCheatWarning = {
  id: string;
  title: string;
  message: string;
  strike: number;
  type: string;
  timestamp: number;
};

export interface UseAntiCheatOptions {
  contestId: string;
  enabled: boolean;
  onAutoSubmit?: () => void;
}

export function useAntiCheat({ contestId, enabled, onAutoSubmit }: UseAntiCheatOptions) {
  const [violations, setViolations] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const [activeWarning, setActiveWarning] = useState<AntiCheatWarning | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [isWindowFocused, setIsWindowFocused] = useState(true);

  const lastEventAt = useRef(0);
  const strikesRef = useRef(0);
  const onAutoSubmitRef = useRef(onAutoSubmit);
  onAutoSubmitRef.current = onAutoSubmit;

  const reportViolation = useCallback(
    (
      eventType: string,
      title: string,
      message: string,
      details: Record<string, string | number | boolean> = {},
      consumeStrike = true,
    ) => {
      const now = Date.now();
      // Cooldown to prevent duplicate events for the same action (e.g. blur + visibilitychange)
      if (now - lastEventAt.current < 1200) return;
      lastEventAt.current = now;

      setViolations((count) => count + 1);

      let currentStrikes = strikesRef.current;
      if (consumeStrike) {
        currentStrikes = Math.min(MAX_STRIKES, currentStrikes + 1);
        strikesRef.current = currentStrikes;
        setStrikes(currentStrikes);
      }

      // Record to remote Supabase DB
      void supabase.rpc("record_contest_violation", {
        _contest_id: contestId,
        _event_type: eventType,
        _details: {
          ...details,
          strikes: currentStrikes,
          screenWidth: window.screen.width,
          screenHeight: window.screen.height,
          windowWidth: window.innerWidth,
          windowHeight: window.innerHeight,
          timestamp: new Date().toISOString(),
        },
      });

      // Present prominent warning modal
      setActiveWarning({
        id: `${eventType}-${now}`,
        title,
        message,
        strike: currentStrikes,
        type: eventType,
        timestamp: now,
      });

      // If strike limit exceeded, trigger automatic submission
      if (currentStrikes >= MAX_STRIKES && onAutoSubmitRef.current) {
        onAutoSubmitRef.current();
      }
    },
    [contestId],
  );

  useEffect(() => {
    if (!enabled) return;

    // 1. Fullscreen monitoring
    const onFullscreenChange = () => {
      const inFullscreen = Boolean(document.fullscreenElement);
      setIsFullscreen(inFullscreen);
      if (!inFullscreen) {
        reportViolation(
          "fullscreen_exit",
          "Fullscreen Focus Lost",
          "Exiting fullscreen mode is strictly prohibited during the exam. Please return to fullscreen immediately.",
          { isFullscreen: false },
          true,
        );
      }
    };

    // 2. Tab switch / browser minimized detection
    const onVisibilityChange = () => {
      if (document.hidden) {
        setIsWindowFocused(false);
        reportViolation(
          "tab_switch_hidden",
          "Tab Switch / Minimized Detected",
          "You switched away from the examination tab. Any switching between browser tabs or windows is logged as a violation.",
          { visibilityState: document.visibilityState },
          true,
        );
      } else {
        setIsWindowFocused(true);
      }
    };

    // 3. Window blur detection (Catches background windows, clicking outside, split-screen apps, Alt+Tab, secondary monitors)
    const onWindowBlur = () => {
      setIsWindowFocused(false);
      reportViolation(
        "window_blur",
        "Window Focus Lost",
        "Focus was shifted away from the exam window (e.g. clicking an outside app, floating window, background notes, or dual monitor).",
        { activeElement: document.activeElement?.tagName ?? "unknown" },
        true,
      );
    };

    const onWindowFocus = () => {
      setIsWindowFocused(true);
    };

    // 4. Cursor leaving the viewport detection
    const onMouseLeave = (e: MouseEvent) => {
      // Check if mouse genuinely left the top/left/right/bottom bounds of viewport
      if (
        e.clientY <= 0 ||
        e.clientX <= 0 ||
        e.clientX >= window.innerWidth ||
        e.clientY >= window.innerHeight
      ) {
        // Track without burning a strike immediately, unless repeated
        reportViolation(
          "cursor_out_of_bounds",
          "Mouse Left Test Window",
          "Your mouse cursor moved outside the browser window. Please keep your cursor within the examination area.",
          { clientX: e.clientX, clientY: e.clientY },
          false,
        );
      }
    };

    // 5. Window resize detection (e.g. snapping window or shrinking to reveal background window)
    let resizeTimer: number;
    const onWindowResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (!document.fullscreenElement) {
          reportViolation(
            "window_resize",
            "Window Resize Detected",
            "Resizing the examination window or altering screen dimensions is not allowed.",
            { innerWidth: window.innerWidth, innerHeight: window.innerHeight },
            true,
          );
        }
      }, 500);
    };

    // 6. Strict clipboard & selection protection
    const blockCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      reportViolation(
        "clipboard_copy_blocked",
        "Copying Forbidden",
        "Copying questions or exam content to clipboard is strictly prohibited and logged.",
        { target: (e.target as HTMLElement)?.tagName ?? "unknown" },
        true,
      );
    };

    const blockCut = (e: ClipboardEvent) => {
      e.preventDefault();
      reportViolation(
        "clipboard_cut_blocked",
        "Cut Action Blocked",
        "Cutting text is disabled during the exam.",
        {},
        true,
      );
    };

    const blockPaste = (e: ClipboardEvent) => {
      // Allow pasting in code editor textarea only if needed, OR block entirely for strict academic integrity
      e.preventDefault();
      reportViolation(
        "clipboard_paste_blocked",
        "Pasting Forbidden",
        "Pasting external code or answers from clipboard is strictly forbidden.",
        { target: (e.target as HTMLElement)?.tagName ?? "unknown" },
        true,
      );
    };

    // 7. Context menu (right-click) protection
    const blockContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      reportViolation(
        "context_menu_blocked",
        "Right-Click Disabled",
        "Context menu and inspect element options are disabled.",
        {},
        false,
      );
    };

    // 8. Restricted keyboard shortcuts
    const detectKeyShortcuts = (e: KeyboardEvent) => {
      const key = e.key.toUpperCase();
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;

      // DevTools shortcuts: F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
      const isDevTools =
        e.key === "F12" ||
        (isCtrlOrMeta && e.shiftKey && ["I", "J", "C"].includes(key)) ||
        (isCtrlOrMeta && key === "U"); // View source

      // Copy, Paste, Cut shortcuts
      const isClipboardShortcut = isCtrlOrMeta && ["C", "V", "X"].includes(key);

      // Print, Save shortcuts
      const isPrintOrSave = isCtrlOrMeta && ["P", "S"].includes(key);

      // Select all shortcut outside inputs
      const isSelectAll =
        isCtrlOrMeta &&
        key === "A" &&
        !(e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement);

      // Refresh shortcut: F5, Ctrl+R
      const isRefresh = e.key === "F5" || (isCtrlOrMeta && key === "R");

      if (isDevTools || isClipboardShortcut || isPrintOrSave || isSelectAll || isRefresh) {
        e.preventDefault();
        e.stopPropagation();

        const label = isDevTools
          ? "Developer Tools Shortcut"
          : isClipboardShortcut
            ? "Clipboard Shortcut"
            : isPrintOrSave
              ? "Print/Save Shortcut"
              : isRefresh
                ? "Refresh Shortcut"
                : "Select All Shortcut";

        reportViolation(
          "restricted_key_shortcut",
          `${label} Blocked`,
          `Keyboard shortcut [${e.ctrlKey ? "Ctrl+" : ""}${e.shiftKey ? "Shift+" : ""}${e.key}] is disabled during the exam.`,
          { key: e.key, code: e.code },
          true,
        );
      }
    };

    // 9. Before unload protection
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Are you sure you want to leave? Your exam progress may be forfeited.";
      reportViolation("before_unload_attempt", "Page Exit Attempt", "Attempted to close or navigate away from the exam.", {}, true);
      return e.returnValue;
    };

    // Attach listeners
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onWindowBlur);
    window.addEventListener("focus", onWindowFocus);
    document.addEventListener("mouseleave", onMouseLeave);
    window.addEventListener("resize", onWindowResize);
    document.addEventListener("copy", blockCopy);
    document.addEventListener("cut", blockCut);
    document.addEventListener("paste", blockPaste);
    document.addEventListener("contextmenu", blockContextMenu);
    document.addEventListener("keydown", detectKeyShortcuts, true);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("focus", onWindowFocus);
      document.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("resize", onWindowResize);
      document.removeEventListener("copy", blockCopy);
      document.removeEventListener("cut", blockCut);
      document.removeEventListener("paste", blockPaste);
      document.removeEventListener("contextmenu", blockContextMenu);
      document.removeEventListener("keydown", detectKeyShortcuts, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [enabled, reportViolation]);

  const dismissWarning = useCallback(() => {
    setActiveWarning(null);
  }, []);

  const reenterFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen?.();
        setIsFullscreen(true);
      }
    } catch {
      // Browser may block if not user gesture
    }
  }, []);

  return {
    violations,
    strikes,
    maxStrikes: MAX_STRIKES,
    activeWarning,
    dismissWarning,
    isFullscreen,
    isWindowFocused,
    reenterFullscreen,
  };
}
