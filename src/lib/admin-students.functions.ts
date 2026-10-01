import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const studentInput = z.object({
  loginId: z
    .string()
    .trim()
    .toUpperCase()
    .min(1)
    .max(32)
    .regex(/^[A-Z0-9_-]+$/),
  fullName: z.string().trim().min(2).max(120),
});

const accessInput = z.object({ accessToken: z.string().min(1) });

export const createStudents = createServerFn({ method: "POST" })
  .inputValidator((value) =>
    z
      .object({ accessToken: z.string().min(1), students: z.array(studentInput).min(1).max(90) })
      .parse(value),
  )
  .handler(async ({ data }) => {
    const { admin, actorLoginId } = await requireAdmin(data.accessToken);
    const { data: existingRoles, error: roleError } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role", "student");
    if (roleError) throw new Error(roleError.message);
    if ((existingRoles?.length ?? 0) + data.students.length > 90) {
      throw new Error("The student capacity is 90 accounts.");
    }

    const loginIds = data.students.map((student) => student.loginId);
    const { data: existingProfiles } = await admin
      .from("profiles")
      .select("login_id")
      .in("login_id", loginIds);
    if (existingProfiles?.length)
      throw new Error(
        `Already exists: ${existingProfiles.map((profile) => profile.login_id).join(", ")}`,
      );

    const credentials: Array<{ loginId: string; fullName: string; temporaryPassword: string }> = [];
    for (const student of data.students) {
      const temporaryPassword = generateTemporaryPassword();
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: `${student.loginId.toLowerCase()}@nilgiri.local`,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: { login_id: student.loginId },
      });
      if (createError || !created.user)
        throw new Error(createError?.message ?? "Student account could not be created.");
      const { error: profileError } = await admin.from("profiles").insert({
        id: created.user.id,
        login_id: student.loginId,
        full_name: student.fullName,
        must_change_password: true,
      });
      if (profileError) throw new Error(profileError.message);
      const { error: roleInsertError } = await admin
        .from("user_roles")
        .insert({ user_id: created.user.id, role: "student" });
      if (roleInsertError) throw new Error(roleInsertError.message);
      credentials.push({ ...student, temporaryPassword });
    }

    await admin.from("audit_log").insert({
      actor_login_id: actorLoginId,
      action: "students_created",
      details: {
        count: credentials.length,
        login_ids: credentials.map((credential) => credential.loginId),
      },
    });
    return credentials;
  });

export const resetStudentPassword = createServerFn({ method: "POST" })
  .inputValidator((value) =>
    z.object({ ...accessInput.shape, userId: z.string().uuid() }).parse(value),
  )
  .handler(async ({ data }) => {
    const { admin, actorLoginId } = await requireAdmin(data.accessToken);
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("login_id,full_name")
      .eq("id", data.userId)
      .maybeSingle();
    if (profileError || !profile) throw new Error("Student not found.");
    const { data: role } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId)
      .eq("role", "student")
      .maybeSingle();
    if (!role) throw new Error("Student not found.");
    const temporaryPassword = generateTemporaryPassword();
    const { error } = await admin.auth.admin.updateUserById(data.userId, {
      password: temporaryPassword,
      user_metadata: { login_id: profile.login_id },
    });
    if (error) throw new Error(error.message);
    await admin.from("profiles").update({ must_change_password: true }).eq("id", data.userId);
    await admin.from("login_attempts").delete().eq("login_id", profile.login_id);
    await admin.from("audit_log").insert({
      actor_login_id: actorLoginId,
      action: "student_password_reset",
      details: { login_id: profile.login_id },
    });
    return { loginId: profile.login_id, fullName: profile.full_name, temporaryPassword };
  });

export const unlockStudent = createServerFn({ method: "POST" })
  .inputValidator((value) =>
    z
      .object({ ...accessInput.shape, loginId: z.string().trim().toUpperCase().min(1).max(32) })
      .parse(value),
  )
  .handler(async ({ data }) => {
    const { admin, actorLoginId } = await requireAdmin(data.accessToken);
    await admin.from("login_attempts").delete().eq("login_id", data.loginId);
    await admin.from("audit_log").insert({
      actor_login_id: actorLoginId,
      action: "student_unlocked",
      details: { login_id: data.loginId },
    });
    return true;
  });

async function requireAdmin(accessToken: string) {
  const url = process.env["SUPABASE_URL"];
  const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !publishableKey) throw new Error("Supabase is not configured.");
  const sessionClient = createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await sessionClient.auth.getUser(accessToken);
  if (userError || !userData.user) throw new Error("Your session has expired.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: role } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!role) throw new Error("Admin access required.");
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("login_id")
    .eq("id", userData.user.id)
    .maybeSingle();
  return { admin: supabaseAdmin, actorLoginId: profile?.login_id ?? "admin" };
}

function generateTemporaryPassword() {
  return `Temp-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}!`;
}
