import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const GENERIC = "Invalid ID or password.";

/**
 * Closed-cohort login by Student/Admin ID. Tracks failed attempts server-side
 * and locks the ID for 15 minutes after 5 failures. Errors stay generic so
 * the response never reveals whether an ID exists.
 */
export const loginWithId = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        loginId: z
          .string()
          .trim()
          .min(1)
          .max(32)
          .regex(/^[A-Za-z0-9_-]+$/),
        password: z.string().min(1).max(128),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const loginId = data.loginId.toUpperCase();
    const now = new Date();

    const { data: att } = await supabaseAdmin
      .from("login_attempts")
      .select("*")
      .eq("login_id", loginId)
      .maybeSingle();

    if (att?.locked_until && new Date(att.locked_until) > now) {
      return {
        ok: false as const,
        error: "Too many failed attempts. Try again later.",
        lockedUntil: att.locked_until,
      };
    }

    // Fresh, non-persistent client so the admin client's state is never touched.
    const url = process.env["SUPABASE_URL"]!;
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const headers = new Headers(init?.headers);
          if (headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
          headers.set("apikey", key);
          return fetch(input, { ...init, headers });
        },
      },
    });

    const { data: auth, error } = await client.auth.signInWithPassword({
      email: `${loginId.toLowerCase()}@nilgiri.local`,
      password: data.password,
    });

    if (error || !auth.session) {
      const failed =
        (att && (!att.locked_until || new Date(att.locked_until) <= now) ? att.failed_count : 0) +
        1;
      const locked = failed >= MAX_ATTEMPTS;
      await supabaseAdmin.from("login_attempts").upsert({
        login_id: loginId,
        failed_count: locked ? 0 : failed,
        locked_until: locked ? new Date(now.getTime() + LOCK_MINUTES * 60_000).toISOString() : null,
        updated_at: now.toISOString(),
      });
      await supabaseAdmin.from("audit_log").insert({
        actor_login_id: loginId,
        action: locked ? "login_locked" : "login_failed",
        details: { attempt: failed },
      });
      return locked
        ? {
            ok: false as const,
            error: "Too many failed attempts. Try again later.",
            lockedUntil: null,
          }
        : { ok: false as const, error: GENERIC, lockedUntil: null };
    }

    await supabaseAdmin.from("login_attempts").delete().eq("login_id", loginId);
    await supabaseAdmin
      .from("audit_log")
      .insert({ actor_login_id: loginId, action: "login_success", details: {} });

    return {
      ok: true as const,
      access_token: auth.session.access_token,
      refresh_token: auth.session.refresh_token,
    };
  });
