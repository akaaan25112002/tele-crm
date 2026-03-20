import { supabase } from "@/lib/supabase/client";
import type {
  ActiveCampaignInfo,
  CampaignOption,
  CampaignProgressTele,
  TeleDashboardData,
  TeleShiftActivityRow,
  TeleWeeklyTrendRow,
} from "./tele-dashboard.types";
import {
  buildTeleAttention,
  buildTeleHealth,
  getShiftInfo,
  safePct,
} from "./tele-dashboard.utils";

export const SHIFT_TARGET = 100;
export const DAY_TARGET = 200;

type KpiCallRow = {
  call_log_id?: string | null;
  tele_id?: string | null;
  final_status?: string | null;
  group_name?: string | null;
  detail_name?: string | null;
  called_at?: string | null;
  is_kpi_eligible?: boolean | string | number | null;
};

function todayIsoDate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(date: Date, delta: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + delta);
  return d;
}

function toIsoDate(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function buildShiftBoundaries() {
  const base = new Date();
  const yyyy = base.getFullYear();
  const mm = String(base.getMonth() + 1).padStart(2, "0");
  const dd = String(base.getDate()).padStart(2, "0");

  const shift1Start = new Date(`${yyyy}-${mm}-${dd}T09:00:00`);
  const shift1End = new Date(`${yyyy}-${mm}-${dd}T12:30:00`);

  const shift2Start = new Date(`${yyyy}-${mm}-${dd}T13:00:00`);
  const shift2End = new Date(`${yyyy}-${mm}-${dd}T18:00:00`);

  const dayStart = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
  const dayEnd = new Date(`${yyyy}-${mm}-${dd}T23:59:59`);

  return {
    shift1StartIso: shift1Start.toISOString(),
    shift1EndIso: shift1End.toISOString(),
    shift2StartIso: shift2Start.toISOString(),
    shift2EndIso: shift2End.toISOString(),
    dayStartIso: dayStart.toISOString(),
    dayEndIso: dayEnd.toISOString(),
  };
}

function asTrimmedString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s || null;
}

function asBoolean(value: unknown): boolean {
  if (value === true) return true;
  if (value === false) return false;

  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    return s === "true" || s === "t" || s === "1" || s === "yes";
  }

  if (typeof value === "number") {
    return value === 1;
  }

  return false;
}

function normalizeStatus(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

function isDoneStatus(status: unknown): boolean {
  return normalizeStatus(status) === "DONE";
}

function isCallbackStatus(status: unknown): boolean {
  return normalizeStatus(status) === "CALLBACK";
}

function isInvalidStatus(status: unknown): boolean {
  return normalizeStatus(status) === "INVALID";
}

function isTerminalStatus(status: unknown): boolean {
  const fs = normalizeStatus(status);
  return fs === "DONE" || fs === "INVALID";
}

function isExpiredIso(iso: unknown): boolean {
  if (!iso) return false;
  const ms = new Date(String(iso)).getTime();
  if (Number.isNaN(ms)) return false;
  return ms <= Date.now();
}

function countByStatus(
  rows: Array<{ final_status?: unknown }>,
  predicate: (status: unknown) => boolean
): number {
  return rows.filter((r) => predicate(r.final_status)).length;
}

function isKpiEligibleRow(row: KpiCallRow): boolean {
  return asBoolean(row.is_kpi_eligible);
}

function countKpiEligible(rows: KpiCallRow[]): number {
  return rows.filter(isKpiEligibleRow).length;
}

function buildCustomerName(row: any): string | null {
  const given = asTrimmedString(row["Given Name"]);
  const family = asTrimmedString(row["Family Name"]);

  const full = [given, family]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (full) return full;
  return asTrimmedString(row["Company Name"]);
}

export async function getCurrentTeleUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;

  const uid = data.user?.id ?? null;
  if (!uid) throw new Error("Not authenticated");

  return uid;
}

export async function loadCampaignOptionsForTele(uid: string): Promise<CampaignOption[]> {
  const { data, error } = await supabase
    .from("upload_members")
    .select("upload_id, uploads!inner(id,campaign_name,status)")
    .eq("tele_id", uid);

  if (error) throw error;

  const rows = ((data as any[]) ?? []) as any[];

  return rows
    .map((r) => ({
      id: String(r.uploads.id),
      campaign_name: String(r.uploads.campaign_name ?? ""),
      status: String(r.uploads.status ?? ""),
    }))
    .filter((x) => x.status !== "PAUSE" && x.status !== "DONE");
}

export async function inferActiveCampaignId(uid: string): Promise<string | null> {
  const [holdingsRes, recentCallsRes, options] = await Promise.all([
    supabase
      .from("v_contacts_master_enriched")
      .select("upload_id,current_status,lease_expires_at")
      .eq("assigned_to", uid),

    supabase
      .from("v_call_logs_report")
      .select("upload_id,called_at")
      .eq("tele_id", uid)
      .order("called_at", { ascending: false })
      .limit(20),

    loadCampaignOptionsForTele(uid),
  ]);

  if (holdingsRes.error) throw holdingsRes.error;
  if (recentCallsRes.error) throw recentCallsRes.error;

  const holdingRows = ((holdingsRes.data as any[]) ?? []) as any[];
  const recentCallRows = ((recentCallsRes.data as any[]) ?? []) as any[];

  if (holdingRows.length > 0) {
    const scoreMap = new Map<
      string,
      {
        assigned_count: number;
        active_holding: number;
        callback_holding: number;
        latest_lease_ms: number;
      }
    >();

    for (const row of holdingRows) {
      const uploadId = String(row.upload_id ?? "");
      if (!uploadId) continue;

      const status = normalizeStatus(row.current_status);
      const leaseMs = row.lease_expires_at
        ? new Date(String(row.lease_expires_at)).getTime()
        : 0;
      const expired = leaseMs > 0 && leaseMs <= Date.now();

      let entry = scoreMap.get(uploadId);
      if (!entry) {
        entry = {
          assigned_count: 0,
          active_holding: 0,
          callback_holding: 0,
          latest_lease_ms: 0,
        };
        scoreMap.set(uploadId, entry);
      }

      entry.assigned_count += 1;
      if (!expired && status !== "DONE" && status !== "INVALID") {
        entry.active_holding += 1;
      }
      if (status === "CALLBACK") {
        entry.callback_holding += 1;
      }
      entry.latest_lease_ms = Math.max(entry.latest_lease_ms, leaseMs);
    }

    const ranked = Array.from(scoreMap.entries()).sort((a, b) => {
      if (b[1].active_holding !== a[1].active_holding) {
        return b[1].active_holding - a[1].active_holding;
      }
      if (b[1].assigned_count !== a[1].assigned_count) {
        return b[1].assigned_count - a[1].assigned_count;
      }
      if (b[1].callback_holding !== a[1].callback_holding) {
        return b[1].callback_holding - a[1].callback_holding;
      }
      return b[1].latest_lease_ms - a[1].latest_lease_ms;
    });

    if (ranked.length > 0) {
      return ranked[0][0];
    }
  }

  if (recentCallRows.length > 0) {
    const latest = recentCallRows.find((r) => String(r.upload_id ?? "").trim());
    if (latest?.upload_id) {
      return String(latest.upload_id);
    }
  }

  return options[0]?.id ?? null;
}

async function loadCampaignInfo(uploadId: string): Promise<ActiveCampaignInfo | null> {
  const { data, error } = await supabase
    .from("uploads")
    .select("id,campaign_name,description,filename,status")
    .eq("id", uploadId)
    .single();

  if (error) throw error;
  if (!data) return null;

  return {
    id: String((data as any).id),
    campaign_name: (data as any).campaign_name ?? null,
    description: (data as any).description ?? null,
    filename: (data as any).filename ?? null,
    status: (data as any).status ?? null,
  };
}

async function loadCampaignProgress(uploadId: string): Promise<CampaignProgressTele | null> {
  const { data, error } = await supabase.rpc("rpc_campaign_progress_tele", {
    p_upload_id: uploadId,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;

  return {
    upload_id: String(row.upload_id ?? uploadId),
    status: String(row.status ?? ""),
    total_contacts: Number(row.total_contacts ?? 0),
    done_contacts: Number(row.done_contacts ?? 0),
    remaining_contacts: Number(row.remaining_contacts ?? 0),
    done_percent: Number(row.done_percent ?? 0),
    available_now: Number(row.available_now ?? 0),
    my_holding: Number(row.my_holding ?? 0),
    other_holding: Number(row.other_holding ?? 0),
    capacity_left: Number(row.capacity_left ?? 0),
    callback_contacts: Number(row.callback_contacts ?? 0),
    earliest_my_expiry: row.earliest_my_expiry ? String(row.earliest_my_expiry) : null,
  };
}

export async function loadTeleDashboardData(
  uid: string,
  uploadId: string
): Promise<TeleDashboardData> {
  const today = todayIsoDate();
  const nowIso = new Date().toISOString();
  const weekStart = addDays(new Date(), -6);
  const weekStartIso = `${toIsoDate(weekStart)}T00:00:00`;

  const shift = getShiftInfo();
  const {
    shift1StartIso,
    shift1EndIso,
    shift2StartIso,
    shift2EndIso,
    dayStartIso,
    dayEndIso,
  } = buildShiftBoundaries();

  const shiftActivityStartIso =
    shift.current_shift === "SHIFT_1"
      ? shift1StartIso
      : shift.current_shift === "SHIFT_2"
      ? shift2StartIso
      : dayStartIso;

  const shiftActivityEndIso =
    shift.current_shift === "SHIFT_1"
      ? shift1EndIso
      : shift.current_shift === "SHIFT_2"
      ? shift2EndIso
      : dayEndIso;

  const shiftActivityLabel =
    shift.current_shift === "SHIFT_1"
      ? "All Contacts Processed in Shift 1"
      : shift.current_shift === "SHIFT_2"
      ? "All Contacts Processed in Shift 2"
      : "All Contacts Processed Today";

  const [
    campaignInfo,
    campaignProgress,
    memberRes,
    personalCallsTodayRes,
    personalCallsAllRes,
    holdingsRes,
    overdueRes,
    shiftActivityRes,
    weeklyRes,
    shift1Res,
    shift2Res,
  ] = await Promise.all([
    loadCampaignInfo(uploadId),
    loadCampaignProgress(uploadId),

    supabase.from("upload_members").select("tele_id").eq("upload_id", uploadId),

    supabase
      .from("v_call_logs_report_kpi")
      .select("call_log_id, tele_id, final_status, group_name, detail_name, called_at, is_kpi_eligible")
      .eq("upload_id", uploadId)
      .eq("tele_id", uid)
      .gte("called_at", `${today}T00:00:00`)
      .lte("called_at", `${today}T23:59:59`),

    supabase
      .from("v_call_logs_report_kpi")
      .select("call_log_id, tele_id, final_status, group_name, detail_name, called_at, is_kpi_eligible")
      .eq("upload_id", uploadId)
      .eq("tele_id", uid)
      .order("called_at", { ascending: false }),

    supabase
      .from("v_contacts_master_enriched")
      .select("assigned_to,current_status,lease_expires_at")
      .eq("upload_id", uploadId)
      .eq("assigned_to", uid),

    supabase
      .from("v_contacts_master_enriched")
      .select("assigned_to,current_status,next_call_at")
      .eq("upload_id", uploadId)
      .eq("assigned_to", uid)
      .eq("current_status", "CALLBACK")
      .not("next_call_at", "is", null)
      .lt("next_call_at", nowIso),

    supabase
      .from("v_call_logs_report_kpi")
      .select(
        [
          "call_log_id",
          "called_at",
          "final_status",
          "group_name",
          "detail_name",
          "note_text",
          "is_kpi_eligible",
          `"Person ID"`,
          `"Company Name"`,
          `"Given Name"`,
          `"Family Name"`,
          `"Telephone Number"`,
          `"Mobile Number"`,
        ].join(",")
      )
      .eq("upload_id", uploadId)
      .eq("tele_id", uid)
      .gte("called_at", shiftActivityStartIso)
      .lte("called_at", shiftActivityEndIso)
      .order("called_at", { ascending: false }),

    supabase
      .from("v_call_logs_report_kpi")
      .select("tele_id, final_status, group_name, detail_name, called_at, is_kpi_eligible")
      .eq("upload_id", uploadId)
      .eq("tele_id", uid)
      .gte("called_at", weekStartIso)
      .order("called_at", { ascending: true }),

    supabase
      .from("v_call_logs_report_kpi")
      .select("tele_id, final_status, group_name, detail_name, called_at, is_kpi_eligible")
      .eq("upload_id", uploadId)
      .eq("tele_id", uid)
      .gte("called_at", shift1StartIso)
      .lte("called_at", shift1EndIso),

    supabase
      .from("v_call_logs_report_kpi")
      .select("tele_id, final_status, group_name, detail_name, called_at, is_kpi_eligible")
      .eq("upload_id", uploadId)
      .eq("tele_id", uid)
      .gte("called_at", shift2StartIso)
      .lte("called_at", shift2EndIso),
  ]);

  if (memberRes.error) throw memberRes.error;
  if (personalCallsTodayRes.error) throw personalCallsTodayRes.error;
  if (personalCallsAllRes.error) throw personalCallsAllRes.error;
  if (holdingsRes.error) throw holdingsRes.error;
  if (overdueRes.error) throw overdueRes.error;
  if (shiftActivityRes.error) throw shiftActivityRes.error;
  if (weeklyRes.error) throw weeklyRes.error;
  if (shift1Res.error) throw shift1Res.error;
  if (shift2Res.error) throw shift2Res.error;

  const memberTeleIds = Array.from(
    new Set(
      (((memberRes.data as any[]) ?? []) as any[])
        .map((r) => String(r.tele_id ?? ""))
        .filter(Boolean)
    )
  );

  const callsTodayRows = ((personalCallsTodayRes.data as any[]) ?? []) as KpiCallRow[];
  const callsAllRows = ((personalCallsAllRes.data as any[]) ?? []) as KpiCallRow[];
  const holdingsRows = ((holdingsRes.data as any[]) ?? []) as any[];
  const overdueRows = ((overdueRes.data as any[]) ?? []) as any[];
  const shiftActivityRowsRaw = ((shiftActivityRes.data as any[]) ?? []) as any[];
  const weeklyRowsRaw = ((weeklyRes.data as any[]) ?? []) as KpiCallRow[];
  const shift1Rows = ((shift1Res.data as any[]) ?? []) as KpiCallRow[];
  const shift2Rows = ((shift2Res.data as any[]) ?? []) as KpiCallRow[];

  const done_today = countByStatus(callsTodayRows, isDoneStatus);
  const callback_today = countByStatus(callsTodayRows, isCallbackStatus);
  const invalid_today = countByStatus(callsTodayRows, isInvalidStatus);
  const terminal_today = countByStatus(callsTodayRows, isTerminalStatus);

  const done_total = countByStatus(callsAllRows, isDoneStatus);
  const callback_total = countByStatus(callsAllRows, isCallbackStatus);
  const invalid_total = countByStatus(callsAllRows, isInvalidStatus);
  const terminal_total = countByStatus(callsAllRows, isTerminalStatus);

  const shift_1_processed = countKpiEligible(shift1Rows);
  const shift_2_processed = countKpiEligible(shift2Rows);
  const kpi_today = countKpiEligible(callsTodayRows);
  const kpi_total = countKpiEligible(callsAllRows);

  const current_shift_processed =
    shift.current_shift === "SHIFT_1"
      ? shift_1_processed
      : shift.current_shift === "SHIFT_2"
      ? shift_2_processed
      : 0;

  const current_shift_target = shift.shift_active ? SHIFT_TARGET : 0;

  const assigned_count = holdingsRows.length;

  const active_holding = holdingsRows.filter((r) => {
    const fs = normalizeStatus(r.current_status);
    const expired = isExpiredIso(r.lease_expires_at);
    return !expired && fs !== "DONE" && fs !== "INVALID";
  }).length;

  const callback_holding = holdingsRows.filter((r) =>
    isCallbackStatus(r.current_status)
  ).length;

  const stale_holding = holdingsRows.filter((r) => {
    const fs = normalizeStatus(r.current_status);
    const expired = isExpiredIso(r.lease_expires_at);
    return expired && fs === "ASSIGNED";
  }).length;

  const shift_activity: TeleShiftActivityRow[] = shiftActivityRowsRaw.map((r) => {
    const telephone_number = asTrimmedString(r["Telephone Number"]);
    const mobile_number = asTrimmedString(r["Mobile Number"]);

    return {
      call_log_id: String(r.call_log_id),
      called_at: String(r.called_at),

      company_name: asTrimmedString(r["Company Name"]),
      person_id: asTrimmedString(r["Person ID"]),
      customer_name: buildCustomerName(r),

      phone: telephone_number ?? mobile_number,
      telephone_number,
      mobile_number,

      final_status: asTrimmedString(r.final_status),
      group_name: asTrimmedString(r.group_name),
      detail_name: asTrimmedString(r.detail_name),
      note_text: asTrimmedString(r.note_text),
      is_kpi_eligible: asBoolean(r.is_kpi_eligible),
    };
  });

  let by_kpi_today_rank: number | null = null;
  let by_conversion_rank: number | null = null;
  let team_size = 0;
  let avg_kpi_today = 0;
  let avg_done_total = 0;
  let avg_conversion_rate = 0;

  if (memberTeleIds.length > 0) {
    const [teamCallsTodayRes, teamCallsAllRes] = await Promise.all([
      supabase
        .from("v_call_logs_report_kpi")
        .select("tele_id, final_status, group_name, detail_name, called_at, is_kpi_eligible")
        .eq("upload_id", uploadId)
        .in("tele_id", memberTeleIds)
        .gte("called_at", `${today}T00:00:00`)
        .lte("called_at", `${today}T23:59:59`),

      supabase
        .from("v_call_logs_report_kpi")
        .select("tele_id, final_status, group_name, detail_name, called_at, is_kpi_eligible")
        .eq("upload_id", uploadId)
        .in("tele_id", memberTeleIds),
    ]);

    if (teamCallsTodayRes.error) throw teamCallsTodayRes.error;
    if (teamCallsAllRes.error) throw teamCallsAllRes.error;

    const teamCallsTodayRows = ((teamCallsTodayRes.data as any[]) ?? []) as KpiCallRow[];
    const teamCallsAllRows = ((teamCallsAllRes.data as any[]) ?? []) as KpiCallRow[];

    const perTeleMap = new Map<
      string,
      {
        kpi_today: number;
        total_calls: number;
        done_total: number;
        conversion_rate: number;
      }
    >();

    const ensureTele = (teleId: string) => {
      let row = perTeleMap.get(teleId);
      if (!row) {
        row = {
          kpi_today: 0,
          total_calls: 0,
          done_total: 0,
          conversion_rate: 0,
        };
        perTeleMap.set(teleId, row);
      }
      return row;
    };

    for (const teleId of memberTeleIds) ensureTele(teleId);

    for (const row of teamCallsTodayRows) {
      const teleId = String(row.tele_id ?? "");
      if (!teleId) continue;

      if (isKpiEligibleRow(row)) {
        ensureTele(teleId).kpi_today += 1;
      }
    }

    for (const row of teamCallsAllRows) {
      const teleId = String(row.tele_id ?? "");
      if (!teleId) continue;

      const t = ensureTele(teleId);
      t.total_calls += 1;

      if (isDoneStatus(row.final_status)) {
        t.done_total += 1;
      }
    }

    const allTeam = Array.from(perTeleMap.entries()).map(([tele_id, v]) => ({
      tele_id,
      kpi_today: v.kpi_today,
      total_calls: v.total_calls,
      done_total: v.done_total,
      conversion_rate: safePct(v.done_total, v.total_calls),
    }));

    team_size = allTeam.length;

    if (team_size > 0) {
      avg_kpi_today = Number(
        (allTeam.reduce((sum, r) => sum + r.kpi_today, 0) / team_size).toFixed(1)
      );
      avg_done_total = Number(
        (allTeam.reduce((sum, r) => sum + r.done_total, 0) / team_size).toFixed(1)
      );
      avg_conversion_rate = Number(
        (allTeam.reduce((sum, r) => sum + r.conversion_rate, 0) / team_size).toFixed(1)
      );

      const byKpi = [...allTeam].sort((a, b) => {
        if (b.kpi_today !== a.kpi_today) {
          return b.kpi_today - a.kpi_today;
        }
        return b.done_total - a.done_total;
      });

      const byConversion = [...allTeam].sort((a, b) => {
        if (b.conversion_rate !== a.conversion_rate) {
          return b.conversion_rate - a.conversion_rate;
        }
        return b.done_total - a.done_total;
      });

      const kpiIndex = byKpi.findIndex((r) => r.tele_id === uid);
      const conversionIndex = byConversion.findIndex((r) => r.tele_id === uid);

      by_kpi_today_rank = kpiIndex >= 0 ? kpiIndex + 1 : null;
      by_conversion_rank = conversionIndex >= 0 ? conversionIndex + 1 : null;
    }
  }

  const dailyMap = new Map<string, TeleWeeklyTrendRow>();

  for (let i = 0; i < 7; i++) {
    const d = addDays(new Date(), -6 + i);
    const key = toIsoDate(d);

    dailyMap.set(key, {
      date_label: key.slice(5),
      calls: 0,
      done: 0,
      terminal: 0,
      kpi: 0,
    });
  }

  for (const row of weeklyRowsRaw) {
    const calledAt = String(row.called_at ?? "");
    const dayKey = calledAt.slice(0, 10);
    const bucket = dailyMap.get(dayKey);
    if (!bucket) continue;

    bucket.calls += 1;
    if (isDoneStatus(row.final_status)) bucket.done += 1;
    if (isTerminalStatus(row.final_status)) bucket.terminal += 1;
    if (isKpiEligibleRow(row)) bucket.kpi += 1;
  }

  const weekly_trend = Array.from(dailyMap.values());

  const health = buildTeleHealth({
    current_shift_processed,
    kpi_today,
    active_holding,
    stale_holding,
    overdue_callbacks: overdueRows.length,
    shift_active: shift.shift_active,
    current_shift_target: SHIFT_TARGET,
    day_target: DAY_TARGET,
  });

  const attention = buildTeleAttention({
    shift,
    kpi_today,
    current_shift_processed,
    active_holding,
    stale_holding,
    overdue_callbacks: overdueRows.length,
    callback_holding,
    current_shift_target: SHIFT_TARGET,
    day_target: DAY_TARGET,
  });

  return {
    campaign: campaignInfo,
    progress: campaignProgress,

    summary: {
      calls_today: callsTodayRows.length,
      done_today,
      callback_today,
      invalid_today,
      terminal_today,

      total_calls: callsAllRows.length,
      done_total,
      callback_total,
      invalid_total,
      terminal_total,

      conversion_rate: safePct(done_total, callsAllRows.length),
      last_call_at: callsAllRows[0]?.called_at ? String(callsAllRows[0].called_at) : null,
    },

    kpi: {
      kpi_today,
      kpi_total,
    },

    queue: {
      assigned_count,
      active_holding,
      callback_holding,
      stale_holding,
      overdue_callbacks: overdueRows.length,
    },

    shift_activity,
    shift_activity_label: shiftActivityLabel,

    attention,
    health,

    shift,
    shift_progress: {
      shift_1_target: SHIFT_TARGET,
      shift_2_target: SHIFT_TARGET,
      day_target: DAY_TARGET,

      shift_1_processed,
      shift_2_processed,
      day_processed: kpi_today,

      current_shift_target,
      current_shift_processed,
      current_shift_progress_pct: shift.shift_active
        ? safePct(current_shift_processed, SHIFT_TARGET)
        : 0,

      shift_1_progress_pct: safePct(shift_1_processed, SHIFT_TARGET),
      shift_2_progress_pct: safePct(shift_2_processed, SHIFT_TARGET),
      day_progress_pct: safePct(kpi_today, DAY_TARGET),

      remaining_to_current_shift: shift.shift_active
        ? Math.max(0, SHIFT_TARGET - current_shift_processed)
        : 0,
      remaining_to_day: Math.max(0, DAY_TARGET - kpi_today),
    },

    campaign_rank: {
      by_kpi_today_rank,
      by_conversion_rank,
      team_size,
    },

    team_average: {
      avg_kpi_today,
      avg_done_total,
      avg_conversion_rate,
    },

    weekly_trend,
  };
}