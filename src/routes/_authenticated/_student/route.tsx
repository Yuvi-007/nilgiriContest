import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_student")({
  beforeLoad: ({ context }) => {
    if (context.authInfo.role !== "student") throw redirect({ to: "/admin" });
  },
  component: () => <Outlet />,
});
