import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { loginWithId } from "@/lib/auth.functions";
import { getAuthInfo, homeFor } from "@/lib/auth";
import { formatIST } from "@/lib/time";

export const Route = createFileRoute("/login")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Log in — nilgiriContest" },
      { name: "description", content: "Sign in with your Student or Admin ID." },
      { property: "og:title", content: "Log in — nilgiriContest" },
      { property: "og:description", content: "Sign in with your Student or Admin ID." },
    ],
  }),
  component: Login,
});

function Login() {
  const login = useServerFn(loginWithId);
  const navigate = useNavigate();
  const router = useRouter();
  const { redirect } = Route.useSearch();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await login({ data: { loginId, password } });
      if (!res.ok) {
        setError(res.lockedUntil ? `${res.error} Locked until ${formatIST(res.lockedUntil, { day: undefined, month: undefined })}.` : res.error);
        return;
      }
      await supabase.auth.setSession({ access_token: res.access_token, refresh_token: res.refresh_token });
      const info = await getAuthInfo();
      if (!info) return setError("Invalid ID or password.");
      if (info.mustChangePassword) return navigate({ to: "/change-password" });
      // Only same-origin relative paths are honoured.
      if (redirect && redirect.startsWith("/") && !redirect.startsWith("//")) {
        return router.history.push(redirect);
      }
      navigate({ to: homeFor(info.role) });
    } catch {
      setError("Invalid ID or password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden px-4">
      <div className="aurora" />
      <form onSubmit={submit} className="glass relative z-10 w-full max-w-sm rounded-2xl p-8">
        <h1 className="text-2xl font-extrabold">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">Use the ID and password given by your admin.</p>
        <div className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="id">Student / Admin ID</Label>
            <Input id="id" autoComplete="username" className="font-mono uppercase" placeholder="STU001" value={loginId} onChange={(e) => setLoginId(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw">Password</Label>
            <div className="relative">
              <Input id="pw" type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required className="pr-10" />
              <button type="button" onClick={() => setShow(!show)} className="absolute inset-y-0 right-0 px-3 text-muted-foreground hover:text-foreground" aria-label={show ? "Hide password" : "Show password"}>
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {error && <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full bg-gradient-primary shadow-glow">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Log in
          </Button>
          <p className="text-center text-xs text-muted-foreground">No sign-up. Forgot your password? Ask your admin to reset it.</p>
        </div>
      </form>
    </div>
  );
}
