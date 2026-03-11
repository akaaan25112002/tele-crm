import type {
  CampaignAttentionItem,
  CampaignDashboardData,
  CampaignHealthSummary,
} from "./campaign-dashboard.types";

export function fmtDT(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export function pct(v?: number | null) {
  return `${Number(v ?? 0).toFixed(1)}%`;
}

export function statusCountMap(
  rows: Array<{ current_status: string; count: number }>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    out[String(r.current_status ?? "").toUpperCase()] = Number(r.count ?? 0);
  }
  return out;
}

export function getCampaignHealth(data: CampaignDashboardData | null): CampaignHealthSummary {
  if (!data || !data.progress || !data.kpis) {
    return {
      state: "MONITOR",
      title: "Campaign health unavailable",
      description: "Some dashboard inputs are missing, so health is shown in monitor mode.",
      reasons: ["Dashboard data is incomplete"],
    };
  }

  const reasons: string[] = [];
  const dangerSignals = 0
    + (data.overdueCallbacks >= 10 ? 1 : 0)
    + (data.staleAssigned >= 10 ? 1 : 0)
    + (data.importIssues7d >= 20 ? 1 : 0);

  const monitorSignals = 0
    + (data.overdueCallbacks > 0 ? 1 : 0)
    + (data.staleAssigned > 0 ? 1 : 0)
    + (data.importIssues7d > 0 ? 1 : 0)
    + ((data.recentActivity?.length ?? 0) === 0 && data.progress.remaining_contacts > 0 ? 1 : 0);

  if (data.overdueCallbacks > 0) reasons.push(`${data.overdueCallbacks} overdue callback(s)`);
  if (data.staleAssigned > 0) reasons.push(`${data.staleAssigned} stale assigned contact(s)`);
  if (data.importIssues7d > 0) reasons.push(`${data.importIssues7d} import issue(s) in 7d`);
  if ((data.recentActivity?.length ?? 0) === 0 && data.progress.remaining_contacts > 0) {
    reasons.push("no recent activity while campaign still has remaining work");
  }

  if (dangerSignals >= 1 || monitorSignals >= 3) {
    return {
      state: "HIGH ATTENTION",
      title: "High attention required",
      description: "This campaign has multiple operational risks and likely needs admin intervention.",
      reasons: reasons.length ? reasons : ["Multiple operational signals detected"],
    };
  }

  if (monitorSignals > 0) {
    return {
      state: "MONITOR",
      title: "Monitor required",
      description: "This campaign is still workable, but there are signals worth reviewing.",
      reasons: reasons.length ? reasons : ["Some moderate signals detected"],
    };
  }

  return {
    state: "STABLE",
    title: "Campaign stable",
    description: "No major operational risk is currently visible for this campaign.",
    reasons: ["Queue and activity look healthy"],
  };
}

export function healthTone(state: CampaignHealthSummary["state"]) {
  if (state === "HIGH ATTENTION") {
    return "border-destructive/40 bg-destructive/5 text-destructive";
  }
  if (state === "MONITOR") {
    return "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300";
  }
  return "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300";
}

export function buildCampaignAttention(
  uploadId: string,
  data: CampaignDashboardData | null
): CampaignAttentionItem[] {
  if (!data || !data.progress || !data.kpis) return [];

  const items: CampaignAttentionItem[] = [];

  if (data.overdueCallbacks > 0) {
    items.push({
      title: "Overdue callbacks",
      detail: `${data.overdueCallbacks} callback contact(s) are already past next_call_at.`,
      href: `/admin/contacts?upload_id=${uploadId}&status=CALLBACK&overdue_callback=1`,
      tone: data.overdueCallbacks >= 10 ? "danger" : "warn",
    });
  }

  if (data.staleAssigned > 0) {
    items.push({
      title: "Stale assigned contacts",
      detail: `${data.staleAssigned} assigned contact(s) have expired lease and should be cleaned or reclaimed.`,
      href: `/admin/contacts?upload_id=${uploadId}&status=ASSIGNED&stale_assigned=1`,
      tone: data.staleAssigned >= 10 ? "danger" : "warn",
    });
  }

  if (data.importIssues7d > 0) {
    items.push({
      title: "Import quality issues",
      detail: `${data.importIssues7d} import issue(s) were recorded in the last 7 days for this campaign.`,
      href: `/admin/uploads/${uploadId}?tab=audit`,
      tone: data.importIssues7d >= 20 ? "danger" : "warn",
    });
  }

  if ((data.recentActivity?.length ?? 0) === 0 && data.progress.remaining_contacts > 0) {
    items.push({
      title: "No recent activity",
      detail: "This campaign still has remaining contacts but no recent call activity was found.",
      href: `/admin/call-logs?upload_id=${uploadId}`,
      tone: "warn",
    });
  }

  if (items.length === 0) {
    items.push({
      title: "No immediate action",
      detail: "No major campaign-specific warning is currently visible.",
      tone: "default",
    });
  }

  return items;
}