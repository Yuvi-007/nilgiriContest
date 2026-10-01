import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Timer, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { hms } from "@/lib/time";
import { Button } from "@/components/ui/button";

function useNow(interval = 1000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(t);
  }, [interval]);
  return now;
}

function CountdownChip() {
  const [next, setNext] = useState<string | null | undefined>(undefined);
  const now = useNow();
  useEffect(() => {
    supabase.rpc("next_contest_start").then(({ data }) => setNext((data as string | null) ?? null));
  }, []);
  if (next === undefined || now === null) return null;
  return (
    <div className="hidden items-center gap-2 rounded-full glass px-3 py-1.5 text-xs sm:flex">
      <Timer className="h-3.5 w-3.5 text-cyan" />
      {next ? (
        <span className="text-muted-foreground">
          next contest in{" "}
          <span className="font-mono text-foreground">{hms(new Date(next).getTime() - now)}</span>
        </span>
      ) : (
        <span className="text-muted-foreground">no contest scheduled</span>
      )}
    </div>
  );
}

export function Navbar() {
  const { auth, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  const link = "text-sm text-muted-foreground transition-colors hover:text-foreground";
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background/70 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        <Link to="/" className="text-lg font-extrabold tracking-tight">
          nilgiri<span className="text-gradient">Contest</span>
        </Link>
        <div className="hidden items-center gap-5 md:flex">
          <Link to="/features" className={link} activeProps={{ className: "text-foreground" }}>
            Features
          </Link>
          <Link to="/rules" className={link} activeProps={{ className: "text-foreground" }}>
            Rules
          </Link>
          <Link to="/leaderboard" className={link} activeProps={{ className: "text-foreground" }}>
            Leaderboard
          </Link>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <CountdownChip />
          {loading ? null : auth ? (
            <>
              <Link to={auth.role === "admin" ? "/admin" : "/dashboard"}>
                <Button size="sm" variant="secondary" className="font-mono">
                  {auth.loginId}
                </Button>
              </Link>
              <Button size="icon" variant="ghost" onClick={signOut} aria-label="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Link to="/login">
              <Button size="sm" className="bg-gradient-primary shadow-glow">
                Log in
              </Button>
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}

export { useNow };
