export type KpiRuleRow = {
  id: string;
  final_status: string;
  group_name: string;
  detail_name: string | null;
  is_kpi_eligible: boolean;
  is_active: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type KpiRuleForm = {
  id?: string;
  final_status: string;
  group_name: string;
  detail_name: string;
  is_kpi_eligible: boolean;
  is_active: boolean;
  note: string;
};

export type KpiRuleFilter = {
  keyword: string;
  finalStatus: "ALL" | "DONE" | "CALLBACK" | "INVALID";
  activeMode: "ALL" | "ACTIVE" | "INACTIVE";
  eligibilityMode: "ALL" | "KPI" | "NON_KPI";
};