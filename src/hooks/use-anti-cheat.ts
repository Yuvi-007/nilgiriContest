import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useAntiCheat(contestId: string, enabled: boolean) {
  const [violations, setViolations] = useState(0);
  const lastEventAt = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const report = (eventType: string, details: Record<string, string> = {}) => {
      const now = Date.now();
      if (now - lastEventAt.current < 750) return;
      lastEventAt.current = now;
      setViolations((count) => count + 1);
      void supabase.rpc("record_contest_violation", {
        _contest_id: contestId,
        _event_type: eventType,
        _details: details,
      });
    };
    const onVisibility = () => document.hidden && report("visibility_hidden");
    const onBlur = () => report("window_blur");
    const onFullscreen = () => !document.fullscreenElement && report("fullscreen_exit");
    const blockClipboard = (event: ClipboardEvent) => {
      event.preventDefault();
      report(event.type, { target: (event.target as HTMLElement)?.tagName ?? "unknown" });
    };
    const blockContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      report("context_menu");
    };
    const detectShortcut = (event: KeyboardEvent) => {
      const devToolsShortcut =
        event.key === "F12" ||
        (event.ctrlKey && event.shiftKey && ["I", "J", "C"].includes(event.key.toUpperCase())) ||
        (event.ctrlKey && event.key.toUpperCase() === "U");
      if (devToolsShortcut) {
        event.preventDefault();
        report("restricted_shortcut", { key: event.key });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    document.addEventListener("fullscreenchange", onFullscreen);
    document.addEventListener("copy", blockClipboard);
    document.addEventListener("cut", blockClipboard);
    document.addEventListener("paste", blockClipboard);
    document.addEventListener("contextmenu", blockContextMenu);
    document.addEventListener("keydown", detectShortcut);
    const onBeforeUnload = () => report("before_unload");
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFullscreen);
      document.removeEventListener("copy", blockClipboard);
      document.removeEventListener("cut", blockClipboard);
      document.removeEventListener("paste", blockClipboard);
      document.removeEventListener("contextmenu", blockContextMenu);
      document.removeEventListener("keydown", detectShortcut);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [contestId, enabled]);

  return violations;
}
