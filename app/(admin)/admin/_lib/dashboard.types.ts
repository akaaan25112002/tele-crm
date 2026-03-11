export type DashboardSummary = {
  total_campaigns: number;
  running_campaigns: number;
  paused_campaigns: number;
  completed_campaigns: number;
  manual_done_campaigns: number;
  total_contacts: number;
  new_contacts: number;
  assigned_contacts: number;
  callback_contacts: number;
  done_contacts: number;
  invalid_contacts: number;
  terminal_contacts: number;
  calls_today: number;
  overdue_callbacks: number;
  stale_assigned: number;
  running_no_activity_today: number;
  total_import_issues_7d: number;
  health: "STABLE" | "MONITOR" | "HIGH ATTENTION" | string;
};

export type CampaignRow = {
  upload_id: string;
  campaign_name: string;
  description: string | null;
  created_at: string;
  status: string;
  total_rows: number;
  total_contacts: number;
  new_contacts: number;
  assigned_contacts: number;
  callback_contacts: number;
  done_contacts: number;
  invalid_contacts: number;
  terminal_contacts: number;
  completion_percent: number;
  calls_today: number;
  issue_count: number;
};

export type TeamRow = {
  tele_id: string;
  full_name: string;
  calls_today: number;
  done_today: number;
  callback_today: number;
  invalid_today: number;
  last_call_at: string | null;
  active_holding: number;
  assigned_holding: number;
  callback_holding: number;
  expired_leases: number;
};

export type AuditSummary = {
  total_issues_7d: number;
  affected_uploads_7d: number;
  top_reason: string | null;
  top_reason_count: number | null;
};

export type AuditTopUpload = {
  upload_id: string;
  campaign_name: string;
  issue_count: number;
};

export type RecentActivityRow = {
  call_log_id: string;
  called_at: string;
  campaign_name: string;
  tele_name: string | null;
  final_status: string | null;
  group_name: string | null;
  detail_name: string | null;
  upload_id: string;
};

export type AdminDashboardData = {
  summary: DashboardSummary | null;
  campaigns: CampaignRow[];
  team: TeamRow[];
  auditSummary: AuditSummary | null;
  auditTopUploads: AuditTopUpload[];
  recentActivity: RecentActivityRow[];
};