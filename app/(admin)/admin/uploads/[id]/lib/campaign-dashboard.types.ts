export type CampaignProgressMin = {
  upload_id: string;
  status: string;
  total_contacts: number;
  done_contacts: number;
  remaining_contacts: number;
  done_percent: number;
};

export type CampaignKpisRow = {
  total: number;
  terminal: number;
  in_progress: number;
  locked: number;
  expired_assigned: number;
  unassigned: number;
  available: number;
};

export type CampaignStatusCount = {
  current_status: string;
  count: number;
};

export type CampaignAttentionItem = {
  title: string;
  detail: string;
  href?: string;
  tone?: "default" | "warn" | "danger";
};

export type CampaignRecentActivityRow = {
  call_log_id: string;
  called_at: string;
  tele_id: string | null;
  tele_name: string | null;
  group_name: string | null;
  detail_name: string | null;
  final_status: string | null;
  note_text: string | null;
  person_id: string | null;
  company_name: string | null;
};

export type CampaignTeamRow = {
  tele_id: string;
  full_name: string;

  calls_today: number;
  total_calls: number;

  done_today: number;
  callback_today: number;
  invalid_today: number;

  done_total: number;
  callback_total: number;
  invalid_total: number;
  terminal_total: number;

  conversion_rate: number;

  active_holding: number;
  callback_holding: number;
  stale_holding: number;
  overdue_callback_owned: number;

  last_call_at: string | null;
};

export type CampaignDashboardData = {
  progress: CampaignProgressMin | null;
  kpis: CampaignKpisRow | null;
  statusCounts: CampaignStatusCount[];
  overdueCallbacks: number;
  staleAssigned: number;
  importIssues7d: number;
  recentActivity: CampaignRecentActivityRow[];
  team: CampaignTeamRow[];
};

export type CampaignHealthState = "STABLE" | "MONITOR" | "HIGH ATTENTION";

export type CampaignHealthSummary = {
  state: CampaignHealthState;
  title: string;
  description: string;
  reasons: string[];
};