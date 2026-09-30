import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "student";
export type AuthInfo = {
  userId: string;
  loginId: string;
  fullName: string;
  role: Role;
  mustChangePassword: boolean;
} | null;

/** Resolve session + profile + role. Used by route guards and the navbar. */
export async function getAuthInfo(): Promise<AuthInfo> {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return null;
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);
  if (!profile) return null;
  const role: Role = roles?.some((r) => r.role === "admin") ? "admin" : "student";
  return {
    userId: user.id,
    loginId: profile.login_id,
    fullName: profile.full_name,
    role,
    mustChangePassword: profile.must_change_password,
  };
}

const Ctx = createContext<{ auth: AuthInfo; loading: boolean; refresh: () => Promise<void> }>({
  auth: null,
  loading: true,
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthInfo>(null);
  const [loading, setLoading] = useState(true);
  const refresh = async () => {
    setAuth(await getAuthInfo());
    setLoading(false);
  };
  useEffect(() => {
    refresh();
    const { data } = supabase.auth.onAuthStateChange(() => {
      setTimeout(refresh, 0);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return <Ctx.Provider value={{ auth, loading, refresh }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

export const homeFor = (role: Role) => (role === "admin" ? "/admin" : "/dashboard");
