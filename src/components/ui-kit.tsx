import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { ContestStatus } from "@/lib/time";

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function GlassCard({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("glass rounded-2xl p-5", className)}>{children}</div>;
}

const statusStyle: Record<ContestStatus, string> = {
  live: "bg-green/15 text-green border-green/30",
  scheduled: "bg-cyan/15 text-cyan border-cyan/30",
  closed: "bg-muted text-muted-foreground border-border",
  draft: "bg-gold/15 text-gold border-gold/30",
};

export function StatusPill({ status }: { status: ContestStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-xs uppercase",
        statusStyle[status],
      )}
    >
      {status === "live" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green" />}
      {status}
    </span>
  );
}

export function Page({ children, calm }: { children: ReactNode; calm?: boolean }) {
  return <div className={cn("mx-auto max-w-6xl px-4 py-10", calm && "calm")}>{children}</div>;
}
