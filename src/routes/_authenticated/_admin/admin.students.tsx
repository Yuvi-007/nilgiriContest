import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, LockOpen, Plus, Upload } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui-kit";
import { formatIST } from "@/lib/time";
import {
  createStudents,
  resetStudentPassword,
  unlockStudent,
} from "@/lib/admin-students.functions";

export const Route = createFileRoute("/_authenticated/_admin/admin/students")({
  head: () => ({ meta: [{ title: "Students — nilgiriContest admin" }] }),
  component: Students,
});

function Students() {
  const queryClient = useQueryClient();
  const create = useServerFn(createStudents);
  const resetPassword = useServerFn(resetStudentPassword);
  const unlock = useServerFn(unlockStudent);
  const [loginId, setLoginId] = useState("");
  const [fullName, setFullName] = useState("");
  const [csv, setCsv] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<
    Array<{ loginId: string; fullName: string; temporaryPassword: string }>
  >([]);
  const { data = [] } = useQuery({
    queryKey: ["admin-students"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").order("login_id"),
        supabase.from("user_roles").select("user_id,role"),
      ]);
      const students = new Set(
        (roles ?? []).filter((r) => r.role === "student").map((r) => r.user_id),
      );
      return (profiles ?? []).filter((p) => students.has(p.id));
    },
  });

  async function accessToken() {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.access_token) throw new Error("Your session has expired.");
    return sessionData.session.access_token;
  }

  async function createOne() {
    try {
      const result = await create({
        data: { accessToken: await accessToken(), students: [{ loginId, fullName }] },
      });
      setCredentials(result);
      setLoginId("");
      setFullName("");
      setMessage("Student created. Save the temporary password before closing this window.");
      await queryClient.invalidateQueries({ queryKey: ["admin-students"] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Student could not be created.");
    }
  }

  async function importCsv() {
    try {
      const rows = csv
        .trim()
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => line.split(",").map((value) => value.trim()));
      const start =
        rows[0]?.[0]?.toLowerCase() === "login_id" || rows[0]?.[0]?.toLowerCase() === "loginid"
          ? 1
          : 0;
      const students = rows
        .slice(start)
        .map(([rowLoginId, rowFullName]) => ({ loginId: rowLoginId, fullName: rowFullName }))
        .filter((student) => student.loginId && student.fullName);
      if (!students.length) throw new Error("CSV must contain login_id and full_name columns.");
      const result = await create({ data: { accessToken: await accessToken(), students } });
      setCredentials(result);
      setCsv("");
      setMessage(
        `${result.length} students created. Save the temporary passwords before closing this window.`,
      );
      await queryClient.invalidateQueries({ queryKey: ["admin-students"] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "CSV import failed.");
    }
  }

  async function reset(userId: string) {
    try {
      const result = await resetPassword({ data: { accessToken: await accessToken(), userId } });
      setCredentials([result]);
      setMessage("Password reset. Save the temporary password before closing this window.");
      await queryClient.invalidateQueries({ queryKey: ["admin-students"] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Password reset failed.");
    }
  }

  async function clearLock(loginIdToUnlock: string) {
    try {
      await unlock({ data: { accessToken: await accessToken(), loginId: loginIdToUnlock } });
      setMessage(`${loginIdToUnlock} unlocked.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unlock failed.");
    }
  }

  return (
    <>
      <PageHeader title="Students" subtitle={`${data.length} student${data.length !== 1 ? "s" : ""} registered`}>
        <Button
          onClick={() => {
            setMessage(null);
            setLoginId("");
            setFullName("");
          }}
        >
          <Plus className="h-4 w-4" /> New student
        </Button>
      </PageHeader>
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <div className="glass rounded-2xl p-5">
          <h2 className="font-bold">Create student</h2>
          <div className="mt-4 grid gap-3">
            <input
              value={loginId}
              onChange={(event) => setLoginId(event.target.value)}
              placeholder="Student ID, e.g. STU009"
              className="h-10 rounded-md border border-border bg-bg3 px-3 text-sm"
            />
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Full name"
              className="h-10 rounded-md border border-border bg-bg3 px-3 text-sm"
            />
            <Button
              onClick={() => void createOne()}
              disabled={!loginId || !fullName}
              className="w-fit"
            >
              <Plus className="h-4 w-4" /> Create
            </Button>
          </div>
        </div>
        <div className="glass rounded-2xl p-5">
          <h2 className="font-bold">CSV bulk import</h2>
          <p className="mt-1 text-xs text-muted-foreground">Columns: login_id, full_name</p>
          <div className="mt-4 grid gap-3">
            <textarea
              value={csv}
              onChange={(event) => setCsv(event.target.value)}
              placeholder={"login_id,full_name\nSTU009,Aarav Sharma"}
              className="min-h-24 rounded-md border border-border bg-bg3 p-3 font-mono text-xs"
            />
            <Button onClick={() => void importCsv()} disabled={!csv.trim()} className="w-fit">
              <Upload className="h-4 w-4" /> Import students
            </Button>
          </div>
        </div>
      </div>
      {message && (
        <p className="mb-5 rounded-md border border-border bg-bg3 p-3 text-sm text-muted-foreground">
          {message}
        </p>
      )}
      <div className="glass overflow-x-auto rounded-2xl">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr className="border-b border-border">
              <th className="p-3">ID</th>
              <th className="p-3">Name</th>
              <th className="p-3">Password</th>
              <th className="p-3">Created</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.id} className="border-b border-border/50 last:border-0">
                <td className="p-3 font-mono">{p.login_id}</td>
                <td className="p-3">{p.full_name}</td>
                <td className="p-3">
                  {p.must_change_password ? (
                    <span className="text-gold">Must change</span>
                  ) : (
                    <span className="text-green">Set</span>
                  )}
                </td>
                <td className="p-3 font-mono text-xs text-muted-foreground">
                  {formatIST(p.created_at)}
                </td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7"
                      onClick={() => void reset(p.id)}
                    >
                      <KeyRound className="h-3.5 w-3.5" /> Reset
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7"
                      onClick={() => void clearLock(p.login_id)}
                    >
                      <LockOpen className="h-3.5 w-3.5" /> Unlock
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {credentials.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Temporary credentials"
        >
          <div className="w-full max-w-lg rounded-lg border border-border bg-background p-6 shadow-xl">
            <h2 className="text-xl font-bold">Temporary credentials</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              These passwords are shown once. Save them before closing.
            </p>
            <div className="mt-5 space-y-3">
              {credentials.map((credential) => (
                <div
                  key={credential.loginId}
                  className="rounded-md border border-border bg-bg3 p-3 font-mono text-sm"
                >
                  <div>
                    {credential.loginId} · {credential.fullName}
                  </div>
                  <div className="mt-1 text-green">{credential.temporaryPassword}</div>
                </div>
              ))}
            </div>
            <Button className="mt-6" onClick={() => setCredentials([])}>
              Close
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
