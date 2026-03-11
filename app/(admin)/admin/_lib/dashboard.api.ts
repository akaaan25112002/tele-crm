import { supabase } from "@/lib/supabase/client";
import type {
  AdminDashboardData,
  AuditSummary,
  AuditTopUpload,
  CampaignRow,
  DashboardSummary,
  RecentActivityRow,
  TeamRow,
} from "./dashboard.types";

function num(v: unknown) {
  return Number(v ?? 0);
}
function text(v: unknown) {
  return String(v ?? "");
}

export async function fetchAdminDashboard(): Promise<AdminDashboardData> {
  const [
    summaryRes,
    campaignsRes,
    teamRes,
    auditSummaryRes,
    auditTopUploadsRes,
    recentActivityRes,
  ] = await Promise.all([
    supabase.rpc("rpc_admin_dashboard_summary"),
    supabase.rpc("rpc_admin_dashboard_recent_campaigns", { p_limit: 6 }),
    supabase.rpc("rpc_admin_dashboard_team", { p_limit: 8 }),
    supabase.rpc("rpc_admin_dashboard_audit_summary"),
    supabase.rpc("rpc_admin_dashboard_audit_top_uploads", { p_limit: 5 }),
    supabase
      .from("v_call_logs_report")
      .select("call_log_id,called_at,campaign_name,tele_name,final_status,group_name,detail_name,upload_id")
      .order("called_at", { ascending: false })
      .limit(8),
  ]);

  if (summaryRes.error) throw summaryRes.error;
  if (campaignsRes.error) throw campaignsRes.error;
  if (teamRes.error) throw teamRes.error;
  if (auditSummaryRes.error) throw auditSummaryRes.error;
  if (auditTopUploadsRes.error) throw auditTopUploadsRes.error;
  if (recentActivityRes.error) throw recentActivityRes.error;

  const summaryRow = ((summaryRes.data as any[]) ?? [])[0];
  const auditSummaryRow = ((auditSummaryRes.data as any[]) ?? [])[0];

  const summary: DashboardSummary | null = summaryRow
    ? {
        total_campaigns: num(summaryRow.total_campaigns),
        running_campaigns: num(summaryRow.running_campaigns),
        paused_campaigns: num(summaryRow.paused_campaigns),
        completed_campaigns: num(summaryRow.completed_campaigns),
        manual_done_campaigns: num(summaryRow.manual_done_campaigns),
        total_contacts: num(summaryRow.total_contacts),
        new_contacts: num(summaryRow.new_contacts),
        assigned_contacts: num(summaryRow.assigned_contacts),
        callback_contacts: num(summaryRow.callback_contacts),
        done_contacts: num(summaryRow.done_contacts),
        invalid_contacts: num(summaryRow.invalid_contacts),
        terminal_contacts: num(summaryRow.terminal_contacts),
        calls_today: num(summaryRow.calls_today),
        overdue_callbacks: num(summaryRow.overdue_callbacks),
        stale_assigned: num(summaryRow.stale_assigned),
        running_no_activity_today: num(summaryRow.running_no_activity_today),
        total_import_issues_7d: num(summaryRow.total_import_issues_7d),
        health: text(summaryRow.health),
      }
    : null;

  const campaigns: CampaignRow[] = (((campaignsRes.data as any[]) ?? []) as any[]).map((row) => ({
    upload_id: text(row.upload_id),
    campaign_name: text(row.campaign_name),
    description: row.description ?? null,
    created_at: text(row.created_at),
    status: text(row.status),
    total_rows: num(row.total_rows),
    total_contacts: num(row.total_contacts),
    new_contacts: num(row.new_contacts),
    assigned_contacts: num(row.assigned_contacts),
    callback_contacts: num(row.callback_contacts),
    done_contacts: num(row.done_contacts),
    invalid_contacts: num(row.invalid_contacts),
    terminal_contacts: num(row.terminal_contacts),
    completion_percent: num(row.completion_percent),
    calls_today: num(row.calls_today),
    issue_count: num(row.issue_count),
  }));

  const team: TeamRow[] = (((teamRes.data as any[]) ?? []) as any[]).map((row) => ({
    tele_id: text(row.tele_id),
    full_name: text(row.full_name),
    calls_today: num(row.calls_today),
    done_today: num(row.done_today),
    callback_today: num(row.callback_today),
    invalid_today: num(row.invalid_today),
    last_call_at: row.last_call_at ?? null,
    active_holding: num(row.active_holding),
    assigned_holding: num(row.assigned_holding),
    callback_holding: num(row.callback_holding),
    expired_leases: num(row.expired_leases),
  }));

  const auditSummary: AuditSummary | null = auditSummaryRow
    ? {
        total_issues_7d: num(auditSummaryRow.total_issues_7d),
        affected_uploads_7d: num(auditSummaryRow.affected_uploads_7d),
        top_reason: auditSummaryRow.top_reason ?? null,
        top_reason_count:
          auditSummaryRow.top_reason_count == null
            ? null
            : num(auditSummaryRow.top_reason_count),
      }
    : null;

  const auditTopUploads: AuditTopUpload[] = (((auditTopUploadsRes.data as any[]) ?? []) as any[]).map((row) => ({
    upload_id: text(row.upload_id),
    campaign_name: text(row.campaign_name),
    issue_count: num(row.issue_count),
  }));

  const recentActivity: RecentActivityRow[] = (((recentActivityRes.data as any[]) ?? []) as any[]).map((row) => ({
    call_log_id: text(row.call_log_id),
    called_at: text(row.called_at),
    campaign_name: text(row.campaign_name),
    tele_name: row.tele_name ?? null,
    final_status: row.final_status ?? null,
    group_name: row.group_name ?? null,
    detail_name: row.detail_name ?? null,
    upload_id: text(row.upload_id),
  }));

  return {
    summary,
    campaigns,
    team,
    auditSummary,
    auditTopUploads,
    recentActivity,
  };
}