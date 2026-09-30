import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Page, PageHeader, GlassCard } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/_student/profile")({
  head: () => ({ meta: [{ title: "Profile — nilgiriContest" }] }),
  component: Profile,
});

function Profile() {
  const { authInfo } = Route.useRouteContext();
  return (
    <Page>
      <PageHeader title="Profile" />
      <GlassCard className="max-w-md space-y-3">
        <div><div className="text-xs text-muted-foreground">Name</div><div className="font-semibold">{authInfo.fullName}</div></div>
        <div><div className="text-xs text-muted-foreground">Student ID</div><div className="font-mono">{authInfo.loginId}</div></div>
        <Link to="/change-password"><Button variant="secondary" size="sm">Change password</Button></Link>
      </GlassCard>
    </Page>
  );
}
