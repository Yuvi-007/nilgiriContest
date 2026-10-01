import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getAuthInfo } from "@/lib/auth";

// Session gate for every signed-in page. Forces the first-login password change.
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const authInfo = await getAuthInfo();
    if (!authInfo) throw redirect({ to: "/login", search: { redirect: location.href } });
    if (authInfo.mustChangePassword && location.pathname !== "/change-password") {
      throw redirect({ to: "/change-password" });
    }
    return { authInfo };
  },
  component: () => <Outlet />,
});
