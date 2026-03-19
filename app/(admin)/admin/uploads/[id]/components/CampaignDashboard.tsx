"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { downloadWorkbookXlsx } from "@/lib/crm/export";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CampaignStickySummary from "./CampaignStickySummary";
import ImportBatchHistoryCard from "./ImportBatchHistoryCard";
import DeleteBatchDialog from "./DeleteBatchDialog";
import {
  buildCampaignAttention,
  fmtDT,
  getCampaignHealth,
  healthTone,
  pct,
  statusCountMap,
} from "../lib/campaign-dashboard.utils";
import type {
  CampaignDashboardData,
  CampaignKpisRow,
  CampaignProgressMin,
  CampaignRecentActivityRow,
  CampaignStatusCount,
  CampaignTeamRow,
} from "../lib/campaign-dashboard.types";
import { useImportBatchHistory } from "../hooks/useImportBatchHistory";
import { useCampaignPurge } from "../hooks/useCampaignPurge";

function todayIsoDate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function SummaryChip(props: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border px-3 py-2">
      <div className="text-[11px] opacity-60">{props.label}</div>
      <div className="mt-1 text-sm font-semibold tabular-nums">{props.value}</div>
    </div>
  );
}

function MiniStat(props: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border p-2">
      <div className="text-[11px] opacity-60">{props.label}</div>
      <div className="mt-1 text-sm font-semibold tabular-nums">{props.value}</div>
    </div>
  );
}

function RankCard(props: {
  title: string;
  name: string;
  detail: string;
  tone?: "default" | "good" | "warn" | "danger";
}) {
  const toneClass =
    props.tone === "good"
      ? "border-emerald-500/30 bg-emerald-500/5"
      : props.tone === "warn"
      ? "border-amber-500/30 bg-amber-500/5"
      : props.tone === "danger"
      ? "border-destructive/40 bg-destructive/5"
      : "border-border";

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="text-xs uppercase tracking-wide opacity-60">{props.title}</div>
      <div className="mt-1 text-sm font-semibold">{props.name}</div>
      <div className="mt-1 text-xs opacity-70">{props.detail}</div>
    </div>
  );
}

function finalStatusBadge(s?: string | null) {
  const text = String(s ?? "").trim().toUpperCase();
  if (!text) return null;
  if (text === "DONE") {
    return <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">DONE</Badge>;
  }
  if (text === "INVALID") {
    return <Badge className="bg-rose-600 text-white hover:bg-rose-600">INVALID</Badge>;
  }
  if (text === "CALLBACK") {
    return <Badge className="bg-amber-500 text-black hover:bg-amber-500">CALLBACK</Badge>;
  }
  return <Badge variant="outline">{text}</Badge>;
}

type TeamSortKey =
  | "calls_today"
  | "total_calls"
  | "done_total"
  | "conversion_rate"
  | "active_holding"
  | "stale_holding"
  | "overdue_callback_owned"
  | "last_call_at";

function safePct(num: number, den: number) {
  if (!den) return 0;
  return Number(((num / den) * 100).toFixed(1));
}

function safeName(x?: string | null) {
  return String(x ?? "Unknown").trim() || "Unknown";
}

export default function CampaignDashboard(props: {
  uploadId: string;
  campaignName?: string | null;
  campaignStatus?: string | null;
  refreshToken?: number;
  onAfterBatchDeleted?: () => Promise<void> | void;
}) {
  const { uploadId, campaignName, campaignStatus, refreshToken, onAfterBatchDeleted } = props;

  const importHistoryVm = useImportBatchHistory(uploadId);
  const batchPurgeVm = useCampaignPurge(uploadId);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [errorText, setErrorText] = useState("");
  const [teamSortKey, setTeamSortKey] = useState<TeamSortKey>("calls_today");

  const [data, setData] = useState<CampaignDashboardData>({
    progress: null,
    kpis: null,
    statusCounts: [],
    overdueCallbacks: 0,
    staleAssigned: 0,
    importIssues7d: 0,
    recentActivity: [],
    team: [],
  });

  const loadDashboard = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (!uploadId) return;

      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);
      setErrorText("");

      try {
        const today = todayIsoDate();
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const [
          progressRes,
          kpisRes,
          statusRes,
          overdueRes,
          staleRes,
          issuesRes,
          activityRes,
          uploadMembersRes,
          contactsHoldingRes,
          teleCallsTodayRes,
          teleCallsAllRes,
          overdueOwnedRes,
        ] = await Promise.all([
          supabase.rpc("rpc_campaign_progress_min", { p_upload_id: uploadId }),

          supabase.rpc("rpc_campaign_kpis", { p_upload_id: uploadId }),

          supabase.rpc("rpc_contact_status_counts", { p_upload_id: uploadId }),

          supabase
            .from("v_contacts_master_enriched")
            .select("contact_id", { count: "exact", head: true })
            .eq("upload_id", uploadId)
            .eq("current_status", "CALLBACK")
            .not("next_call_at", "is", null)
            .lt("next_call_at", new Date().toISOString()),

          supabase
            .from("v_contacts_master_enriched")
            .select("contact_id", { count: "exact", head: true })
            .eq("upload_id", uploadId)
            .eq("current_status", "ASSIGNED")
            .not("lease_expires_at", "is", null)
            .lte("lease_expires_at", new Date().toISOString()),

          supabase
            .from("contact_import_issues")
            .select("id", { count: "exact", head: true })
            .eq("upload_id", uploadId)
            .gte("created_at", sevenDaysAgo.toISOString()),

          supabase
            .from("v_call_logs_report")
            .select(
              [
                "call_log_id",
                "called_at",
                "tele_id",
                "tele_name",
                "group_name",
                "detail_name",
                "final_status",
                "note_text",
                `"Person ID"`,
                `"Company Name"`,
              ].join(",")
            )
            .eq("upload_id", uploadId)
            .order("called_at", { ascending: false })
            .limit(8),

          supabase
            .from("upload_members")
            .select("tele_id")
            .eq("upload_id", uploadId),

          supabase
            .from("v_contacts_master_enriched")
            .select("assigned_to, assigned_tele_name, current_status, lease_expires_at")
            .eq("upload_id", uploadId)
            .not("assigned_to", "is", null),

          supabase
            .from("v_call_logs_report")
            .select("tele_id, tele_name, final_status, called_at")
            .eq("upload_id", uploadId)
            .gte("called_at", `${today}T00:00:00`)
            .lte("called_at", `${today}T23:59:59`),

          supabase
            .from("v_call_logs_report")
            .select("tele_id, tele_name, final_status, called_at")
            .eq("upload_id", uploadId),

          supabase
            .from("v_contacts_master_enriched")
            .select("assigned_to, assigned_tele_name, current_status, next_call_at")
            .eq("upload_id", uploadId)
            .eq("current_status", "CALLBACK")
            .not("assigned_to", "is", null)
            .not("next_call_at", "is", null)
            .lt("next_call_at", new Date().toISOString()),
        ]);

        if (progressRes.error) throw progressRes.error;
        if (kpisRes.error) throw kpisRes.error;
        if (statusRes.error) throw statusRes.error;
        if (overdueRes.error) throw overdueRes.error;
        if (staleRes.error) throw staleRes.error;
        if (issuesRes.error) throw issuesRes.error;
        if (activityRes.error) throw activityRes.error;
        if (uploadMembersRes.error) throw uploadMembersRes.error;
        if (contactsHoldingRes.error) throw contactsHoldingRes.error;
        if (teleCallsTodayRes.error) throw teleCallsTodayRes.error;
        if (teleCallsAllRes.error) throw teleCallsAllRes.error;
        if (overdueOwnedRes.error) throw overdueOwnedRes.error;

        const memberTeleIds = Array.from(
          new Set(
            (((uploadMembersRes.data as any[]) ?? []) as any[])
              .map((r) => String(r.tele_id ?? ""))
              .filter(Boolean)
          )
        );

        let profileNameMap = new Map<string, string>();

        if (memberTeleIds.length > 0) {
          const { data: profilesData, error: profilesErr } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", memberTeleIds);

          if (profilesErr) throw profilesErr;

          profileNameMap = new Map(
            (((profilesData as any[]) ?? []) as any[]).map((p) => [
              String(p.id),
              safeName(p.full_name),
            ])
          );
        }

        const progressRaw = Array.isArray(progressRes.data) ? progressRes.data[0] : progressRes.data;
        const kpisRaw = Array.isArray(kpisRes.data) ? kpisRes.data[0] : kpisRes.data;

        const progress: CampaignProgressMin | null = progressRaw
          ? {
              upload_id: String(progressRaw.upload_id ?? uploadId),
              status: String(progressRaw.status ?? ""),
              total_contacts: Number(progressRaw.total_contacts ?? 0),
              done_contacts: Number(progressRaw.done_contacts ?? 0),
              remaining_contacts: Number(progressRaw.remaining_contacts ?? 0),
              done_percent: Number(progressRaw.done_percent ?? 0),
            }
          : null;

        const kpis: CampaignKpisRow | null = kpisRaw
          ? {
              total: Number(kpisRaw.total ?? 0),
              terminal: Number(kpisRaw.terminal ?? 0),
              in_progress: Number(kpisRaw.in_progress ?? 0),
              locked: Number(kpisRaw.locked ?? 0),
              expired_assigned: Number(kpisRaw.expired_assigned ?? 0),
              unassigned: Number(kpisRaw.unassigned ?? 0),
              available: Number(kpisRaw.available ?? 0),
            }
          : null;

        const statusCounts: CampaignStatusCount[] = (((statusRes.data as any[]) ?? []) as any[]).map((r) => ({
          current_status: String(r.current_status ?? ""),
          count: Number(r.count ?? 0),
        }));

        const recentActivity: CampaignRecentActivityRow[] = (((activityRes.data as any[]) ?? []) as any[]).map((r) => ({
          call_log_id: String(r.call_log_id),
          called_at: String(r.called_at),
          tele_id: r.tele_id ? String(r.tele_id) : null,
          tele_name: r.tele_name ?? null,
          group_name: r.group_name ?? null,
          detail_name: r.detail_name ?? null,
          final_status: r.final_status ?? null,
          note_text: r.note_text ?? null,
          person_id: r["Person ID"] ?? null,
          company_name: r["Company Name"] ?? null,
        }));

        const members = memberTeleIds.map((teleId) => ({
          tele_id: teleId,
          full_name: profileNameMap.get(teleId) ?? "Unknown",
        }));

        const holdings = (((contactsHoldingRes.data as any[]) ?? []) as any[]).map((r) => ({
          assigned_to: r.assigned_to ? String(r.assigned_to) : null,
          assigned_tele_name: r.assigned_tele_name ? String(r.assigned_tele_name) : null,
          current_status: String(r.current_status ?? ""),
          lease_expires_at: r.lease_expires_at ? String(r.lease_expires_at) : null,
        }));

        const callsToday = (((teleCallsTodayRes.data as any[]) ?? []) as any[]).map((r) => ({
          tele_id: r.tele_id ? String(r.tele_id) : null,
          tele_name: r.tele_name ? String(r.tele_name) : null,
          final_status: String(r.final_status ?? ""),
          called_at: String(r.called_at),
        }));

        const callsAll = (((teleCallsAllRes.data as any[]) ?? []) as any[]).map((r) => ({
          tele_id: r.tele_id ? String(r.tele_id) : null,
          tele_name: r.tele_name ? String(r.tele_name) : null,
          final_status: String(r.final_status ?? ""),
          called_at: String(r.called_at),
        }));

        const overdueOwned = (((overdueOwnedRes.data as any[]) ?? []) as any[]).map((r) => ({
          assigned_to: r.assigned_to ? String(r.assigned_to) : null,
          assigned_tele_name: r.assigned_tele_name ? String(r.assigned_tele_name) : null,
        }));

        const teamMap = new Map<string, CampaignTeamRow>();

        const ensureTeam = (teleId: string, fullName?: string | null) => {
          let t = teamMap.get(teleId);
          if (!t) {
            t = {
              tele_id: teleId,
              full_name: safeName(fullName ?? profileNameMap.get(teleId) ?? "Unknown"),

              calls_today: 0,
              total_calls: 0,

              done_today: 0,
              callback_today: 0,
              invalid_today: 0,

              done_total: 0,
              callback_total: 0,
              invalid_total: 0,
              terminal_total: 0,

              conversion_rate: 0,

              active_holding: 0,
              callback_holding: 0,
              stale_holding: 0,
              overdue_callback_owned: 0,

              last_call_at: null,
            };
            teamMap.set(teleId, t);
          }
          return t;
        };

        for (const m of members) {
          ensureTeam(m.tele_id, m.full_name);
        }

        for (const row of holdings) {
          if (!row.assigned_to) continue;
          const t = ensureTeam(row.assigned_to, row.assigned_tele_name);

          const expired =
            row.lease_expires_at && new Date(row.lease_expires_at).getTime() <= Date.now();

          if (!expired && !["DONE", "INVALID"].includes(row.current_status.toUpperCase())) {
            t.active_holding += 1;
          }
          if (row.current_status.toUpperCase() === "CALLBACK") {
            t.callback_holding += 1;
          }
          if (expired && row.current_status.toUpperCase() === "ASSIGNED") {
            t.stale_holding += 1;
          }
        }

        for (const row of overdueOwned) {
          if (!row.assigned_to) continue;
          const t = ensureTeam(row.assigned_to, row.assigned_tele_name);
          t.overdue_callback_owned += 1;
        }

        for (const row of callsToday) {
          if (!row.tele_id) continue;
          const t = ensureTeam(row.tele_id, row.tele_name);

          t.calls_today += 1;
          if (row.final_status.toUpperCase() === "DONE") t.done_today += 1;
          if (row.final_status.toUpperCase() === "CALLBACK") t.callback_today += 1;
          if (row.final_status.toUpperCase() === "INVALID") t.invalid_today += 1;

          if (!t.last_call_at || new Date(row.called_at).getTime() > new Date(t.last_call_at).getTime()) {
            t.last_call_at = row.called_at;
          }
        }

        for (const row of callsAll) {
          if (!row.tele_id) continue;
          const t = ensureTeam(row.tele_id, row.tele_name);

          t.total_calls += 1;

          const fs = row.final_status.toUpperCase();
          if (fs === "DONE") t.done_total += 1;
          if (fs === "CALLBACK") t.callback_total += 1;
          if (fs === "INVALID") t.invalid_total += 1;
          if (fs === "DONE" || fs === "INVALID") t.terminal_total += 1;

          if (!t.last_call_at || new Date(row.called_at).getTime() > new Date(t.last_call_at).getTime()) {
            t.last_call_at = row.called_at;
          }
        }

        for (const t of teamMap.values()) {
          t.conversion_rate = safePct(t.done_total, t.total_calls);
        }

        setData({
          progress,
          kpis,
          statusCounts,
          overdueCallbacks: Number(overdueRes.count ?? 0),
          staleAssigned: Number(staleRes.count ?? 0),
          importIssues7d: Number(issuesRes.count ?? 0),
          recentActivity,
          team: Array.from(teamMap.values()),
        });

        setLastUpdatedAt(new Date().toISOString());
      } catch (e: any) {
        console.error(e);
        setErrorText(e?.message ?? "Failed to load campaign dashboard");
      } finally {
        if (mode === "initial") setLoading(false);
        if (mode === "refresh") setRefreshing(false);
      }
    },
    [uploadId]
  );

  useEffect(() => {
    void loadDashboard("initial");
  }, [loadDashboard]);

  useEffect(() => {
    if (refreshToken === undefined) return;
    void loadDashboard("refresh");
  }, [refreshToken, loadDashboard]);

  const health = useMemo(() => getCampaignHealth(data), [data]);
  const statusMap = useMemo(() => statusCountMap(data.statusCounts), [data.statusCounts]);
  const attentionItems = useMemo(() => buildCampaignAttention(uploadId, data), [uploadId, data]);

  const sortedTeam = useMemo(() => {
    const rows = [...data.team];

    rows.sort((a, b) => {
      switch (teamSortKey) {
        case "calls_today":
          return b.calls_today - a.calls_today;
        case "total_calls":
          return b.total_calls - a.total_calls;
        case "done_total":
          return b.done_total - a.done_total;
        case "conversion_rate":
          return b.conversion_rate - a.conversion_rate;
        case "active_holding":
          return b.active_holding - a.active_holding;
        case "stale_holding":
          return b.stale_holding - a.stale_holding;
        case "overdue_callback_owned":
          return b.overdue_callback_owned - a.overdue_callback_owned;
        case "last_call_at":
          return new Date(b.last_call_at ?? 0).getTime() - new Date(a.last_call_at ?? 0).getTime();
        default:
          return 0;
      }
    });

    return rows;
  }, [data.team, teamSortKey]);

  const leaderboard = useMemo(() => {
    const team = [...data.team];
    if (!team.length) {
      return {
        topPerformer: null as CampaignTeamRow | null,
        mostProductive: null as CampaignTeamRow | null,
        queueRisk: null as CampaignTeamRow | null,
        underperformer: null as CampaignTeamRow | null,
      };
    }

    const byConversion = [...team].sort((a, b) => {
      if (b.conversion_rate !== a.conversion_rate) return b.conversion_rate - a.conversion_rate;
      return b.done_total - a.done_total;
    });

    const byVolume = [...team].sort((a, b) => {
      if (b.calls_today !== a.calls_today) return b.calls_today - a.calls_today;
      return b.total_calls - a.total_calls;
    });

    const byRisk = [...team].sort((a, b) => {
      const riskA = a.stale_holding * 3 + a.overdue_callback_owned * 2 + a.callback_holding;
      const riskB = b.stale_holding * 3 + b.overdue_callback_owned * 2 + b.callback_holding;
      return riskB - riskA;
    });

    const byUnder = [...team].sort((a, b) => {
      const scoreA = a.calls_today + a.done_total;
      const scoreB = b.calls_today + b.done_total;
      return scoreA - scoreB;
    });

    return {
      topPerformer: byConversion[0] ?? null,
      mostProductive: byVolume[0] ?? null,
      queueRisk: byRisk[0] ?? null,
      underperformer: byUnder[0] ?? null,
    };
  }, [data.team]);

  const exportCampaignReport = useCallback(async () => {
    try {
      setExporting(true);

      const safeCampaignName = String(campaignName ?? "campaign")
        .trim()
        .replace(/[\\/:*?"<>|]+/g, "-")
        .replace(/\s+/g, "_");

      const healthRows = [
        { Metric: "Campaign ID", Value: uploadId },
        { Metric: "Campaign Name", Value: campaignName ?? "" },
        { Metric: "Campaign Status", Value: campaignStatus ?? "" },
        { Metric: "Health State", Value: health.state },
        { Metric: "Health Title", Value: health.title },
        { Metric: "Health Description", Value: health.description },
        { Metric: "Done %", Value: Number(data.progress?.done_percent ?? 0) },
        { Metric: "Total Contacts", Value: Number(data.progress?.total_contacts ?? 0) },
        { Metric: "Done Contacts", Value: Number(data.progress?.done_contacts ?? 0) },
        { Metric: "Remaining Contacts", Value: Number(data.progress?.remaining_contacts ?? 0) },
        { Metric: "Available Now", Value: Number(data.kpis?.available ?? 0) },
        { Metric: "Locked Now", Value: Number(data.kpis?.locked ?? 0) },
        { Metric: "Unassigned", Value: Number(data.kpis?.unassigned ?? 0) },
        { Metric: "Expired Assigned", Value: Number(data.kpis?.expired_assigned ?? 0) },
        { Metric: "Overdue Callbacks", Value: Number(data.overdueCallbacks ?? 0) },
        { Metric: "Stale Assigned", Value: Number(data.staleAssigned ?? 0) },
        { Metric: "Import Issues (7d)", Value: Number(data.importIssues7d ?? 0) },
        { Metric: "Exported At", Value: new Date().toLocaleString() },
      ];

      const teleRows = sortedTeam.map((row, idx) => ({
        Rank: idx + 1,
        "Campaign ID": uploadId,
        "Campaign Name": campaignName ?? "",
        "Campaign Status": campaignStatus ?? "",
        "Tele ID": row.tele_id,
        "Tele Name": row.full_name,
        "Calls Today": row.calls_today,
        "Total Calls": row.total_calls,
        "Done Today": row.done_today,
        "Callback Today": row.callback_today,
        "Invalid Today": row.invalid_today,
        "Done Total": row.done_total,
        "Callback Total": row.callback_total,
        "Invalid Total": row.invalid_total,
        "Terminal Total": row.terminal_total,
        "Conversion %": row.conversion_rate,
        "Active Holding": row.active_holding,
        "Callback Holding": row.callback_holding,
        "Stale Holding": row.stale_holding,
        "Overdue Callback Owned": row.overdue_callback_owned,
        "Last Call At": row.last_call_at ? fmtDT(row.last_call_at) : "",
      }));

      const statusRows = data.statusCounts.map((s) => ({
        Status: s.current_status,
        Count: s.count,
      }));

      const activityRows = data.recentActivity.map((r) => ({
        "Called At": fmtDT(r.called_at),
        "Tele Name": r.tele_name ?? "",
        "Company": r.company_name ?? "",
        "Person ID": r.person_id ?? "",
        "Final Status": r.final_status ?? "",
        "Group": r.group_name ?? "",
        "Detail": r.detail_name ?? "",
        "Note": r.note_text ?? "",
      }));

      downloadWorkbookXlsx(`${safeCampaignName}_campaign_report`, [
        {
          name: "Campaign Health",
          headers: ["Metric", "Value"],
          rows: healthRows,
        },
        {
          name: "Tele KPI",
          headers: [
            "Rank",
            "Campaign ID",
            "Campaign Name",
            "Campaign Status",
            "Tele ID",
            "Tele Name",
            "Calls Today",
            "Total Calls",
            "Done Today",
            "Callback Today",
            "Invalid Today",
            "Done Total",
            "Callback Total",
            "Invalid Total",
            "Terminal Total",
            "Conversion %",
            "Active Holding",
            "Callback Holding",
            "Stale Holding",
            "Overdue Callback Owned",
            "Last Call At",
          ],
          rows: teleRows,
        },
        {
          name: "Status Summary",
          headers: ["Status", "Count"],
          rows: statusRows,
        },
        {
          name: "Recent Activity",
          headers: [
            "Called At",
            "Tele Name",
            "Company",
            "Person ID",
            "Final Status",
            "Group",
            "Detail",
            "Note",
          ],
          rows: activityRows,
        },
      ]);
    } finally {
      setExporting(false);
    }
  }, [sortedTeam, data, uploadId, campaignName, campaignStatus, health]);

  if (loading) {
    return (
      <div className="grid gap-4">
        <Card>
          <CardContent className="py-6">
            <div className="h-6 rounded bg-muted animate-pulse" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <CampaignStickySummary
        uploadId={uploadId}
        campaignName={campaignName}
        campaignStatus={campaignStatus}
        healthState={health.state}
        donePercent={Number(data.progress?.done_percent ?? 0)}
        remainingContacts={Number(data.progress?.remaining_contacts ?? 0)}
        overdueCallbacks={Number(data.overdueCallbacks ?? 0)}
        staleAssigned={Number(data.staleAssigned ?? 0)}
        availableNow={Number(data.kpis?.available ?? 0)}
        onRefresh={() => void loadDashboard("refresh")}
        refreshing={refreshing}
      />

      {errorText ? (
        <Card className="border-destructive/40">
          <CardContent className="py-4 text-sm text-destructive">{errorText}</CardContent>
        </Card>
      ) : null}

      <Card className={healthTone(health.state)}>
        <CardContent className="py-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="text-sm font-semibold uppercase tracking-wide">{health.title}</div>
              <div className="mt-1 text-sm opacity-90">{health.description}</div>

              {health.reasons.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {health.reasons.map((r) => (
                    <div key={r} className="rounded-full border px-2.5 py-1 text-xs">
                      {r}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="text-right text-xs opacity-80">
              <div>Last updated</div>
              <div className="font-medium">{lastUpdatedAt ? fmtDT(lastUpdatedAt) : "—"}</div>
              <div className="mt-2 flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => void loadDashboard("refresh")} disabled={refreshing}>
                  {refreshing ? "Refreshing..." : "Refresh dashboard"}
                </Button>
                <Button variant="outline" size="sm" onClick={exportCampaignReport} disabled={exporting}>
                  {exporting ? "Exporting..." : "Export Campaign Report"}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <SummaryChip label="Total" value={data.progress?.total_contacts ?? 0} />
        <SummaryChip label="Done" value={data.progress?.done_contacts ?? 0} />
        <SummaryChip label="Remaining" value={data.progress?.remaining_contacts ?? 0} />
        <SummaryChip label="Done %" value={pct(data.progress?.done_percent ?? 0)} />
        <SummaryChip label="Available now" value={data.kpis?.available ?? 0} />
        <SummaryChip label="Locked now" value={data.kpis?.locked ?? 0} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Campaign Performance Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          {data.team.length === 0 ? (
            <div className="text-sm opacity-70">No team data found for this campaign.</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <RankCard
                title="Top Performer"
                name={leaderboard.topPerformer?.full_name ?? "—"}
                detail={
                  leaderboard.topPerformer
                    ? `${pct(leaderboard.topPerformer.conversion_rate)} conversion • ${leaderboard.topPerformer.done_total} done`
                    : "No data"
                }
                tone="good"
              />

              <RankCard
                title="Most Productive"
                name={leaderboard.mostProductive?.full_name ?? "—"}
                detail={
                  leaderboard.mostProductive
                    ? `${leaderboard.mostProductive.calls_today} calls today • ${leaderboard.mostProductive.total_calls} total calls`
                    : "No data"
                }
                tone="good"
              />

              <RankCard
                title="Queue Risk"
                name={leaderboard.queueRisk?.full_name ?? "—"}
                detail={
                  leaderboard.queueRisk
                    ? `${leaderboard.queueRisk.stale_holding} stale • ${leaderboard.queueRisk.overdue_callback_owned} overdue owned`
                    : "No data"
                }
                tone="warn"
              />

              <RankCard
                title="Needs Coaching"
                name={leaderboard.underperformer?.full_name ?? "—"}
                detail={
                  leaderboard.underperformer
                    ? `${leaderboard.underperformer.calls_today} calls today • ${leaderboard.underperformer.done_total} done total`
                    : "No data"
                }
                tone="danger"
              />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Contact Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Link href={`/admin/contacts?upload_id=${uploadId}&status=NEW`}><div><MiniStat label="NEW" value={statusMap.NEW ?? 0} /></div></Link>
              <Link href={`/admin/contacts?upload_id=${uploadId}&status=ASSIGNED`}><div><MiniStat label="ASSIGNED" value={statusMap.ASSIGNED ?? 0} /></div></Link>
              <Link href={`/admin/contacts?upload_id=${uploadId}&status=CALLBACK`}><div><MiniStat label="CALLBACK" value={statusMap.CALLBACK ?? 0} /></div></Link>
              <Link href={`/admin/contacts?upload_id=${uploadId}&status=DONE`}><div><MiniStat label="DONE" value={statusMap.DONE ?? 0} /></div></Link>
              <Link href={`/admin/contacts?upload_id=${uploadId}&status=INVALID`}><div><MiniStat label="INVALID" value={statusMap.INVALID ?? 0} /></div></Link>
              <Link href={`/admin/contacts?upload_id=${uploadId}&terminal=1`}><div><MiniStat label="TERMINAL" value={data.kpis?.terminal ?? 0} /></div></Link>
            </div>

            <div className="rounded-xl border p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="opacity-70">Terminal progress</span>
                <span className="font-medium">{pct(data.progress?.done_percent ?? 0)}</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-foreground/70"
                  style={{ width: `${Math.max(0, Math.min(100, Number(data.progress?.done_percent ?? 0)))}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="min-h-0">
          <CardHeader className="pb-3">
            <CardTitle>Needs Attention</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[360px] overflow-y-auto pr-1 space-y-3">
              {attentionItems.map((item, idx) =>
                item.href ? (
                  <Link
                    key={idx}
                    href={item.href}
                    className={`block rounded-xl border p-4 transition hover:bg-muted/40 ${
                      item.tone === "danger"
                        ? "border-destructive/40"
                        : item.tone === "warn"
                        ? "border-amber-500/30"
                        : ""
                    }`}
                  >
                    <div className="text-sm font-medium">{item.title}</div>
                    <div className="mt-1 text-sm opacity-70">{item.detail}</div>
                  </Link>
                ) : (
                  <div key={idx} className="rounded-xl border p-4">
                    <div className="text-sm font-medium">{item.title}</div>
                    <div className="mt-1 text-sm opacity-70">{item.detail}</div>
                  </div>
                )
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="min-h-0">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <CardTitle>Tele Performance Report</CardTitle>

              <div className="w-[220px]">
                <Select value={teamSortKey} onValueChange={(v) => setTeamSortKey(v as TeamSortKey)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sort team" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="calls_today">Calls today</SelectItem>
                    <SelectItem value="total_calls">Total calls</SelectItem>
                    <SelectItem value="done_total">Done total</SelectItem>
                    <SelectItem value="conversion_rate">Conversion rate</SelectItem>
                    <SelectItem value="active_holding">Active holding</SelectItem>
                    <SelectItem value="stale_holding">Stale holding</SelectItem>
                    <SelectItem value="overdue_callback_owned">Overdue callback owned</SelectItem>
                    <SelectItem value="last_call_at">Last call at</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {sortedTeam.length === 0 ? (
              <div className="text-sm opacity-70">No team member is currently attached to this campaign.</div>
            ) : (
              <div className="max-h-[520px] overflow-y-auto pr-1 space-y-3">
                {sortedTeam.map((row, idx) => (
                  <div key={row.tele_id} className="rounded-2xl border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">
                          #{idx + 1} · {row.full_name}
                        </div>
                        <div className="mt-1 text-xs opacity-70">Last call: {fmtDT(row.last_call_at)}</div>
                      </div>

                      <div className="text-right text-xs opacity-70">
                        Conversion: <span className="font-medium">{pct(row.conversion_rate)}</span>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                      <MiniStat label="Calls Today" value={row.calls_today} />
                      <MiniStat label="Total Calls" value={row.total_calls} />
                      <MiniStat label="Done Today" value={row.done_today} />
                      <MiniStat label="Done Total" value={row.done_total} />
                      <MiniStat label="Callback Today" value={row.callback_today} />
                      <MiniStat label="Callback Total" value={row.callback_total} />
                      <MiniStat label="Invalid Today" value={row.invalid_today} />
                      <MiniStat label="Invalid Total" value={row.invalid_total} />
                      <MiniStat label="Terminal Total" value={row.terminal_total} />
                      <MiniStat label="Active Holding" value={row.active_holding} />
                      <MiniStat label="Callback Holding" value={row.callback_holding} />
                      <MiniStat label="Stale Holding" value={row.stale_holding} />
                      <MiniStat label="Overdue Owned" value={row.overdue_callback_owned} />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link href={`/admin/contacts?upload_id=${uploadId}&assigned_to=${row.tele_id}`}>
                        <Button variant="outline" size="sm">Assigned contacts</Button>
                      </Link>
                      <Link href={`/admin/call-logs?upload_id=${uploadId}&tele_id=${row.tele_id}`}>
                        <Button variant="outline" size="sm">Call logs</Button>
                      </Link>
                      <Link href={`/admin/contacts?upload_id=${uploadId}&assigned_to=${row.tele_id}&status=CALLBACK&overdue_callback=1`}>
                        <Button variant="outline" size="sm">Overdue callbacks</Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="min-h-0">
          <CardHeader className="pb-3">
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentActivity.length === 0 ? (
              <div className="text-sm opacity-70">No recent call activity found for this campaign.</div>
            ) : (
              <div className="max-h-[520px] overflow-y-auto pr-1 space-y-3">
                {data.recentActivity.map((item) => (
                  <Link
                    key={item.call_log_id}
                    href={`/admin/call-logs?upload_id=${uploadId}`}
                    className="block rounded-xl border p-4 transition hover:bg-muted/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">
                          {item.company_name || item.person_id || "Recent call"}
                        </div>
                        <div className="mt-1 text-xs opacity-70">
                          {item.tele_name || "Unknown tele"} · {fmtDT(item.called_at)}
                        </div>
                      </div>

                      <div>{finalStatusBadge(item.final_status)}</div>
                    </div>

                    <div className="mt-2 text-sm opacity-80">
                      {item.group_name || "—"} {item.detail_name ? `· ${item.detail_name}` : ""}
                    </div>

                    <div className="mt-2 text-xs opacity-60 line-clamp-2">
                      {item.note_text || "No note"}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Queue & Data Quality</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <SummaryChip label="Available now" value={data.kpis?.available ?? 0} />
            <SummaryChip label="Unassigned" value={data.kpis?.unassigned ?? 0} />
            <SummaryChip label="Locked" value={data.kpis?.locked ?? 0} />
            <SummaryChip label="Expired assigned" value={data.kpis?.expired_assigned ?? 0} />
            <SummaryChip label="Import issues (7d)" value={data.importIssues7d} />
          </div>
        </CardContent>
      </Card>

      <ImportBatchHistoryCard
        historyVm={importHistoryVm}
        purgeVm={batchPurgeVm}
        refreshToken={refreshToken}
        onAfterBatchDeleted={async () => {
          await onAfterBatchDeleted?.();
        }}
      />

      <DeleteBatchDialog
        vm={batchPurgeVm}
        onCompleted={async () => {
          batchPurgeVm.setDeleteBatchOpen(false);
          await importHistoryVm.load();
          await onAfterBatchDeleted?.();
        }}
      />
    </div>
  );
}