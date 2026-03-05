export type CampaignStatus = "RUNNING" | "PAUSE" | "COMPLETED" | "DONE";
export const CAMPAIGN_STATUSES: CampaignStatus[] = ["RUNNING", "PAUSE", "COMPLETED", "DONE"];

export type Upload = {
  id: string;
  campaign_name: string;
  description: string | null;
  filename: string | null;
  total_rows: number;
  status: CampaignStatus;
  created_at: string;
};

export type Tele = { id: string; full_name: string | null };

export type ContactRow = {
  id: string;
  upload_id: string;
  row_no: number | null;

  company_name: string | null;
  given_name: string | null;
  family_name: string | null;
  email: string | null;
  normalized_phone: string | null;

  current_status: string;
  call_attempts: number;
  last_called_at: string | null;

  last_result_group: string | null;
  last_result_detail: string | null;
  last_note_text: string | null;

  assigned_to: string | null;
  assigned_name: string | null;
  assigned_at: string | null;
  lease_expires_at: string | null;

  last_action_by: string | null;
  last_action_name: string | null;
  last_action_at: string | null;
};

export const CONTACT_STATUS_OPTIONS = ["ALL", "NEW", "ASSIGNED", "CALLBACK", "INVALID", "DONE"] as const;
export type ContactStatusFilter = (typeof CONTACT_STATUS_OPTIONS)[number];

export type AssigneeFilter =
  | { type: "ALL" }
  | { type: "UNASSIGNED" }
  | { type: "TELE"; teleId: string };

export type CallResult = {
  id: string;
  group_name: string;
  detail_name: string;
  sort_order: number;
  final_status: string;
  is_terminal: boolean;
};

export type ContactEditRow = {
  field_name: string;
  old_value: string | null;
  new_value: string;
  edited_at: string;
  edited_by: string | null;
  edited_by_name?: string | null;
};

export type CallLogRow = {
  called_at: string;
  result_group: string | null;
  result_detail: string | null;
  note_text: string | null;
  created_by: string | null;
  created_by_name?: string | null;
};

export type SortKey = "row_no" | "current_status" | "assigned_name" | "lease_expires_at" | "last_called_at";

export type CampaignKpis = {
  total: number;
  terminal: number;
  in_progress: number;
  locked: number;
  expired_assigned: number;
  unassigned: number;
  available: number;
};