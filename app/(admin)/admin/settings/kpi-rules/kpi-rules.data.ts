import { supabase } from "@/lib/supabase/client";
import type { KpiRuleForm, KpiRuleRow } from "./kpi-rules.types";

function normalizeNullableText(value: string): string | null {
  const v = value.trim();
  return v ? v : null;
}

function normalizeRequiredText(value: string): string {
  return value.trim().toUpperCase();
}

export async function loadKpiRules(): Promise<KpiRuleRow[]> {
  const { data, error } = await supabase
    .from("v_kpi_result_rules")
    .select("*")
    .order("final_status", { ascending: true })
    .order("group_name", { ascending: true })
    .order("detail_name", { ascending: true });

  if (error) throw error;

  return ((data as any[]) ?? []).map((r) => ({
    id: String(r.id),
    final_status: String(r.final_status ?? ""),
    group_name: String(r.group_name ?? ""),
    detail_name: r.detail_name ? String(r.detail_name) : null,
    is_kpi_eligible: Boolean(r.is_kpi_eligible),
    is_active: Boolean(r.is_active),
    note: r.note ? String(r.note) : null,
    created_at: String(r.created_at ?? ""),
    updated_at: String(r.updated_at ?? ""),
  }));
}

export async function createKpiRule(input: KpiRuleForm): Promise<KpiRuleRow> {
  const payload = {
    final_status: normalizeRequiredText(input.final_status),
    group_name: normalizeRequiredText(input.group_name),
    detail_name: normalizeNullableText(input.detail_name)?.toUpperCase() ?? null,
    is_kpi_eligible: Boolean(input.is_kpi_eligible),
    is_active: Boolean(input.is_active),
    note: normalizeNullableText(input.note),
  };

  const { data, error } = await supabase
    .from("kpi_result_rules")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;

  return {
    id: String((data as any).id),
    final_status: String((data as any).final_status ?? ""),
    group_name: String((data as any).group_name ?? ""),
    detail_name: (data as any).detail_name ? String((data as any).detail_name) : null,
    is_kpi_eligible: Boolean((data as any).is_kpi_eligible),
    is_active: Boolean((data as any).is_active),
    note: (data as any).note ? String((data as any).note) : null,
    created_at: String((data as any).created_at ?? ""),
    updated_at: String((data as any).updated_at ?? ""),
  };
}

export async function updateKpiRule(input: KpiRuleForm): Promise<KpiRuleRow> {
  if (!input.id) throw new Error("Missing rule id");

  const payload = {
    final_status: normalizeRequiredText(input.final_status),
    group_name: normalizeRequiredText(input.group_name),
    detail_name: normalizeNullableText(input.detail_name)?.toUpperCase() ?? null,
    is_kpi_eligible: Boolean(input.is_kpi_eligible),
    is_active: Boolean(input.is_active),
    note: normalizeNullableText(input.note),
  };

  const { data, error } = await supabase
    .from("kpi_result_rules")
    .update(payload)
    .eq("id", input.id)
    .select("*")
    .single();

  if (error) throw error;

  return {
    id: String((data as any).id),
    final_status: String((data as any).final_status ?? ""),
    group_name: String((data as any).group_name ?? ""),
    detail_name: (data as any).detail_name ? String((data as any).detail_name) : null,
    is_kpi_eligible: Boolean((data as any).is_kpi_eligible),
    is_active: Boolean((data as any).is_active),
    note: (data as any).note ? String((data as any).note) : null,
    created_at: String((data as any).created_at ?? ""),
    updated_at: String((data as any).updated_at ?? ""),
  };
}

export async function deleteKpiRule(ruleId: string): Promise<void> {
  const { error } = await supabase.rpc("rpc_delete_kpi_rule", {
    p_rule_id: ruleId,
  });

  if (error) throw error;
}