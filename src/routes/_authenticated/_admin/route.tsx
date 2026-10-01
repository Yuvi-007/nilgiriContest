import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_admin")({
  beforeLoad: ({ context }) => {
    if (context.authInfo.role !== "admin") throw redirect({ to: "/dashboard" });
  },
  component: AdminLayout,
});

const tabs = [
  { to: "/admin", label: "Overview" },
  { to: "/admin/students", label: "Students" },
  { to: "/admin/questions", label: "Questions" },
  { to: "/admin/contests", label: "Contests" },
  { to: "/admin/audit", label: "Audit log" },
] as const;

function AdminLayout() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            activeOptions={{ exact: true }}
            className="rounded-full border border-border px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            activeProps={{ className: "bg-primary text-primary-foreground border-primary" }}
          >
            {t.label}
          </Link>
        ))}
      </div>
      <Outlet />
    </div>
  );
}
