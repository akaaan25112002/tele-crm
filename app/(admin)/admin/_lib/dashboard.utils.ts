import type { CampaignRow, DashboardSummary } from "./dashboard.types";

export function fmtDT(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export function pct(v: number) {
  return `${Number(v ?? 0).toFixed(1)}%`;
}

export function statusBarPercent(value: number, total: number) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, (value / total) * 100));
}

export function healthTone(health: string) {
  const h = health.toUpperCase();
  if (h === "HIGH ATTENTION") {
    return "border-destructive/40 bg-destructive/5 text-destructive";
  }
  if (h === "MONITOR") {
    return "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300";
  }
  return "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300";
}

export function buildNeedsAttention(summary: DashboardSummary | null) {
  if (!summary) return [];

  const items: { title: string; detail: string; href?: string }[] = [];

  if (summary.paused_campaigns > 0) {
    items.push({
      title: "Paused campaigns",
      detail: `${summary.paused_campaigns} campaign đang ở trạng thái PAUSE và cần admin review.`,
      href: "/admin/uploads?status=PAUSE",
    });
  }

  if (summary.overdue_callbacks > 0) {
    items.push({
      title: "Overdue callbacks",
      detail: `${summary.overdue_callbacks} contact CALLBACK đã quá hạn follow-up.`,
      href: "/admin/contacts?status=CALLBACK&overdue_callback=1",
    });
  }

  if (summary.stale_assigned > 0) {
    items.push({
      title: "Stale assigned contacts",
      detail: `${summary.stale_assigned} contact ASSIGNED đã hết lease hoặc chưa được xử lý tiếp.`,
      href: "/admin/contacts?status=ASSIGNED&stale_assigned=1",
    });
  }

  if (summary.running_no_activity_today > 0) {
    items.push({
      title: "Idle running campaigns",
      detail: `${summary.running_no_activity_today} campaign RUNNING chưa ghi nhận activity hôm nay.`,
      href: "/admin/uploads?status=RUNNING&activity=today_none",
    });
  }

  if (summary.new_contacts > 100) {
    items.push({
      title: "High NEW backlog",
      detail: `${summary.new_contacts} contact vẫn ở trạng thái NEW, cần cân nhắc rebalance workload.`,
      href: "/admin/contacts?status=NEW",
    });
  }

  if (summary.total_import_issues_7d > 0) {
    items.push({
      title: "Import quality issues",
      detail: `${summary.total_import_issues_7d} import issue được ghi nhận trong 7 ngày gần nhất.`,
      href: "/admin/uploads?issues=has_recent",
    });
  }

  if (items.length === 0) {
    items.push({
      title: "System stable",
      detail: "Không có cảnh báo vận hành lớn ở thời điểm hiện tại.",
    });
  }

  return items;
}

export function getTopCampaignByIssues(campaigns: CampaignRow[]) {
  if (!campaigns.length) return null;
  return [...campaigns].sort((a, b) => b.issue_count - a.issue_count)[0] ?? null;
}