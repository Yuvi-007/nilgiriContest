import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { LayoutDashboard, Users, BookOpen, Trophy, ScrollText, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_admin")({
  beforeLoad: ({ context }) => {
    if (context.authInfo.role !== "admin") throw redirect({ to: "/dashboard" });
  },
  component: AdminLayout,
});

const tabs = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/admin/students", label: "Students", icon: Users, exact: false },
  { to: "/admin/questions", label: "Questions", icon: BookOpen, exact: false },
  { to: "/admin/contests", label: "Contests", icon: Trophy, exact: false },
  { to: "/admin/audit", label: "Audit log", icon: ScrollText, exact: false },
] as const;

function AdminLayout() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Breadcrumb */}
      <div className="mb-5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="font-mono font-semibold text-violet">Admin</span>
        <ChevronRight className="h-3 w-3 opacity-40" />
        <span>Control Panel</span>
      </div>

      {/* Tab nav — styled as pill tabs with icons */}
      <div className="mb-8 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            activeOptions={{ exact: t.exact }}
            className="admin-tab"
            activeProps={{ className: "admin-tab admin-tab-active" }}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </Link>
        ))}
      </div>

      <Outlet />
    </div>
  );
}
