import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  Timer,
  LogOut,
  User,
  ChevronDown,
  Menu,
  X,
  LayoutDashboard,
  Trophy,
  BookOpen,
  Sparkles,
  Shield,
} from "lucide-react";
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

function UserDropdown({
  loginId,
  role,
  onSignOut,
}: {
  loginId: string;
  role: string;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const dashboardTo = role === "admin" ? "/admin" : "/dashboard";

  return (
    <div ref={ref} className="relative">
      <button
        id="user-menu-trigger"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1.5 text-sm transition-all hover:border-violet/40 hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-primary text-xs font-bold text-white">
          {loginId[0]?.toUpperCase()}
        </span>
        <span className="font-mono text-xs">{loginId}</span>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${role === "admin" ? "bg-violet/15 text-violet" : "bg-cyan/15 text-cyan"}`}
        >
          {role === "admin" ? <Shield className="h-2.5 w-2.5" /> : <Sparkles className="h-2.5 w-2.5" />}
          {role}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-xl border border-border bg-popover shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150"
        >
          <div className="border-b border-border px-4 py-3">
            <p className="font-mono text-sm font-semibold">{loginId}</p>
            <p className="mt-0.5 text-xs text-muted-foreground capitalize">{role} account</p>
          </div>
          <div className="p-1">
            <Link
              to={dashboardTo}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
            {role === "student" && (
              <Link
                to="/profile"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <User className="h-4 w-4" />
                Profile
              </Link>
            )}
          </div>
          <div className="border-t border-border p-1">
            <button
              role="menuitem"
              onClick={() => { setOpen(false); onSignOut(); }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const navLinks = [
  { to: "/features", label: "Features", icon: Sparkles },
  { to: "/rules", label: "Rules", icon: BookOpen },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
] as const;

export function Navbar() {
  const { auth, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const routerState = useRouterState();

  // Close mobile menu on navigation
  useEffect(() => setMobileOpen(false), [routerState.location.pathname]);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background/75 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        {/* Logo */}
        <Link to="/" className="shrink-0 text-lg font-extrabold tracking-tight">
          nilgiri<span className="text-gradient">Contest</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-1 md:flex">
          {navLinks.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              activeProps={{ className: "bg-accent text-foreground" }}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-3">
          <CountdownChip />

          {loading ? null : auth ? (
            <UserDropdown loginId={auth.loginId} role={auth.role} onSignOut={signOut} />
          ) : (
            <Link to="/login">
              <Button size="sm" className="bg-gradient-primary shadow-glow shimmer-button">
                Log in
              </Button>
            </Link>
          )}

          {/* Mobile hamburger */}
          <button
            id="mobile-menu-toggle"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </nav>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="border-t border-border bg-background/95 px-4 py-3 md:hidden animate-in slide-in-from-top-2 duration-200">
          {navLinks.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              activeProps={{ className: "bg-accent text-foreground" }}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
          {auth && (
            <>
              <div className="my-2 border-t border-border" />
              <Link
                to={auth.role === "admin" ? "/admin" : "/dashboard"}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
              <button
                onClick={() => { setMobileOpen(false); void signOut(); }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-destructive transition-colors hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </>
          )}
        </div>
      )}
    </header>
  );
}

export { useNow };
