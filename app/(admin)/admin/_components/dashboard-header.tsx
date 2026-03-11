import Link from "next/link";
import { Button } from "@/components/ui/button";
import { fmtDT } from "../_lib/dashboard.utils";

export function DashboardHeader(props: {
  lastUpdatedAt: string | null;
  refreshing: boolean;
  cleaningLeases: boolean;
  onRefresh: () => void;
  onCleanupExpiredLeases: () => void;
}) {
  const {
    lastUpdatedAt,
    refreshing,
    cleaningLeases,
    onRefresh,
    onCleanupExpiredLeases,
  } = props;

  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <div>
        <div className="text-2xl font-bold tracking-tight">Admin Dashboard</div>
        <div className="text-sm opacity-70">
          Campaign operations, contact pipeline, team performance, and audit health.
        </div>
        <div className="mt-1 text-xs opacity-60">
          Last updated: {lastUpdatedAt ? fmtDT(lastUpdatedAt) : "—"}
          {refreshing ? " · Refreshing..." : ""}
          {cleaningLeases ? " · Cleaning expired leases..." : ""}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onRefresh} disabled={refreshing || cleaningLeases}>
          {refreshing ? "Refreshing..." : "Refresh"}
        </Button>

        <Button
          variant="outline"
          onClick={onCleanupExpiredLeases}
          disabled={cleaningLeases || refreshing}
        >
          {cleaningLeases ? "Cleaning..." : "Cleanup Expired Leases"}
        </Button>

        <Link href="/admin/uploads">
          <Button variant="outline" disabled={cleaningLeases}>
            View Uploads
          </Button>
        </Link>

        <Link href="/admin/uploads">
          <Button disabled={cleaningLeases}>Import Campaign</Button>
        </Link>
      </div>
    </div>
  );
}