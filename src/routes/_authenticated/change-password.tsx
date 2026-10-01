import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { homeFor, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/change-password")({
  head: () => ({
    meta: [{ title: "Change password — nilgiriContest" }, { name: "robots", content: "noindex" }],
  }),
  component: ChangePassword,
});

function ChangePassword() {
  const { authInfo } = Route.useRouteContext();
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw))
      return setErr("Use at least 8 characters with letters and numbers.");
    if (pw !== pw2) return setErr("Passwords do not match.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) {
      setBusy(false);
      return setErr(
        error.message.includes("different")
          ? "Choose a password different from the current one."
          : "Could not update password.",
      );
    }
    await supabase.rpc("mark_password_changed");
    await refresh();
    toast.success("Password updated");
    navigate({ to: homeFor(authInfo.role) });
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <form onSubmit={submit} className="glass w-full max-w-sm space-y-4 rounded-2xl p-8">
        <div>
          <h1 className="text-2xl font-extrabold">Set a new password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {authInfo.mustChangePassword ? "Required on first login." : "Update your password."}{" "}
            Signed in as <span className="font-mono">{authInfo.loginId}</span>.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p1">New password</Label>
          <Input
            id="p1"
            type="password"
            autoComplete="new-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p2">Confirm password</Label>
          <Input
            id="p2"
            type="password"
            autoComplete="new-password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
          />
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button disabled={busy} className="w-full bg-gradient-primary">
          Save password
        </Button>
      </form>
    </div>
  );
}
