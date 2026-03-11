"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";

type StickyHealthState = "STABLE" | "MONITOR" | "HIGH ATTENTION";

function healthBadge(state: StickyHealthState) {
  if (state === "HIGH ATTENTION") {
    return <Badge className="bg-rose-600 text-white hover:bg-rose-600">HIGH ATTENTION</Badge>;
  }
  if (state === "MONITOR") {
    return <Badge className="bg-amber-500 text-black hover:bg-amber-500">MONITOR</Badge>;
  }
  return <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">STABLE</Badge>;
}

function fmtPct(v?: number | null) {
  return `${Number(v ?? 0).toFixed(1)}%`;
}

function Cell(props: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="min-w-[90px]">
      <div className="text-[10px] uppercase tracking-wide opacity-60">{props.label}</div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{props.value}</div>
    </div>
  );
}

export default function CampaignStickySummary(props: {
  uploadId: string;
  campaignName?: string | null;
  campaignStatus?: string | null;

  healthState: StickyHealthState;
  donePercent: number;
  remainingContacts: number;
  overdueCallbacks: number;
  staleAssigned: number;
  availableNow: number;

  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
}) {
  const {
    uploadId,
    campaignName,
    campaignStatus,
    healthState,
    donePercent,
    remainingContacts,
    overdueCallbacks,
    staleAssigned,
    availableNow,
    onRefresh,
    refreshing,
  } = props;

  return (
    <div className="sticky top-0 z-30">
      <div className="rounded-2xl border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-sm">
        <div className="flex flex-col gap-3 px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-semibold truncate">
                {campaignName || "Campaign"}
              </div>
              <StatusBadge status={campaignStatus ?? "RUNNING"} kind="campaign" />
              {healthBadge(healthState)}
            </div>

            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
              <Cell label="Done %" value={fmtPct(donePercent)} />
              <Cell label="Remaining" value={remainingContacts} />
              <Cell label="Overdue CB" value={overdueCallbacks} />
              <Cell label="Stale Assigned" value={staleAssigned} />
              <Cell label="Available" value={availableNow} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href={`/admin/contacts?upload_id=${uploadId}`}>
              <Button variant="outline" size="sm">Contacts</Button>
            </Link>

            <Link href={`/admin/call-logs?upload_id=${uploadId}`}>
              <Button variant="outline" size="sm">Call Logs</Button>
            </Link>

            <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}