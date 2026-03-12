export type CampaignOption = {
  id: string;
  campaign_name: string;
  status: string;
};

export type ActiveCampaignInfo = {
  id: string;
  campaign_name: string | null;
  description: string | null;
  filename: string | null;
  status: string | null;
};

export type CampaignProgressTele = {
  upload_id: string;
  status: string;
  total_contacts: number;
  done_contacts: number;
  remaining_contacts: number;
  done_percent: number;
  available_now: number;
  my_holding: number;
  other_holding: number;
  capacity_left: number;
  callback_contacts: number;
  earliest_my_expiry: string | null;
};

export type TeleDashboardSummary = {
  calls_today: number;
  done_today: number;
  callback_today: number;
  invalid_today: number;
  terminal_today: number;

  total_calls: number;
  done_total: number;
  callback_total: number;
  invalid_total: number;
  terminal_total: number;

  conversion_rate: number;
  last_call_at: string | null;
};

export type TeleDashboardQueue = {
  assigned_count: number;
  active_holding: number;
  callback_holding: number;
  stale_holding: number;
  overdue_callbacks: number;
};

export type TeleDashboardRecentRow = {
  call_log_id: string;
  called_at: string;
  company_name: string | null;
  person_id: string | null;
  final_status: string | null;
  group_name: string | null;
  detail_name: string | null;
  note_text: string | null;
};

export type TeleDashboardAttentionItem = {
  title: string;
  detail: string;
  tone?: "default" | "warn" | "danger" | "good";
};

export type TeleDashboardHealth = {
  productivity_state: "excellent" | "good" | "idle" | "low";
  productivity_label: string;
  queue_state: "healthy" | "watch" | "risk";
  queue_label: string;
};

export type TeleShiftInfo = {
  current_shift: "SHIFT_1" | "SHIFT_2" | "OUTSIDE_SHIFT";
  current_shift_label: string;
  shift_start_iso: string | null;
  shift_end_iso: string | null;
  shift_active: boolean;
};

export type TeleShiftProgress = {
  shift_1_target: number;
  shift_2_target: number;
  day_target: number;

  shift_1_processed: number;
  shift_2_processed: number;
  day_processed: number;

  current_shift_target: number;
  current_shift_processed: number;
  current_shift_progress_pct: number;

  shift_1_progress_pct: number;
  shift_2_progress_pct: number;
  day_progress_pct: number;

  remaining_to_current_shift: number;
  remaining_to_day: number;
};

export type TeleCampaignRank = {
  by_terminal_today_rank: number | null;
  by_conversion_rank: number | null;
  team_size: number;
};

export type TeleTeamAverage = {
  avg_terminal_today: number;
  avg_done_total: number;
  avg_conversion_rate: number;
};

export type TeleWeeklyTrendRow = {
  date_label: string;
  calls: number;
  done: number;
  terminal: number;
};

export type TeleDashboardData = {
  campaign: ActiveCampaignInfo | null;
  progress: CampaignProgressTele | null;

  summary: TeleDashboardSummary;
  queue: TeleDashboardQueue;
  recent: TeleDashboardRecentRow[];
  attention: TeleDashboardAttentionItem[];
  health: TeleDashboardHealth;

  shift: TeleShiftInfo;
  shift_progress: TeleShiftProgress;

  campaign_rank: TeleCampaignRank;
  team_average: TeleTeamAverage;
  weekly_trend: TeleWeeklyTrendRow[];
};