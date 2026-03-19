"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getCurrentTeleUserId,
  inferActiveCampaignId,
  loadCampaignOptionsForTele,
  loadTeleDashboardData,
} from "./tele-dashboard.data";
import type {
  CampaignOption,
  TeleDashboardData,
  TeleShiftActivityRow,
} from "./tele-dashboard.types";
import {
  clamp,
  fmtDT,
  healthToneClass,
  pct,
} from "./tele-dashboard.utils";

const AUTO_REFRESH_MS = 60_000;

type ActivityFilter = "ALL" | "DONE" | "INVALID" | "CALLBACK";
type KpiFilter = "ALL" | "KPI_ONLY" | "NON_KPI";

function MiniStat(props: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-[11px] opacity-60">{props.label}</div>
      <div className="mt-1 text-sm font-semibold tabular-nums">{props.value}</div>
    </div>
  );
}

function SectionCard(props: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card className="min-h-0">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{props.title}</CardTitle>
          {props.action}
        </div>
      </CardHeader>
      <CardContent>{props.children}</CardContent>
    </Card>
  );
}

function finalStatusBadge(fs?: string | null) {
  const text = String(fs ?? "").trim().toUpperCase();
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

function ProgressBar(props: { value: number }) {
  const v = clamp(Number(props.value ?? 0), 0, 100);
  return (
    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-foreground/70" style={{ width: `${v}%` }} />
    </div>
  );
}

function TrendBar(props: { value: number; max: number }) {
  const width = props.max > 0 ? (props.value / props.max) * 100 : 0;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-foreground/70" style={{ width: `${width}%` }} />
    </div>
  );
}

function buildActivityPhones(row: TeleShiftActivityRow) {
  const parts = [row.telephone_number, row.mobile_number].filter(
    (x): x is string => Boolean(x && x.trim())
  );

  if (parts.length === 0) return "—";

  return parts.join(" | ");
}

const EMPTY_DATA: TeleDashboardData = {
  campaign: null,
  progress: null,
  summary: {
    calls_today: 0,
    done_today: 0,
    callback_today: 0,
    invalid_today: 0,
    terminal_today: 0,
    total_calls: 0,
    done_total: 0,
    callback_total: 0,
    invalid_total: 0,
    terminal_total: 0,
    conversion_rate: 0,
    last_call_at: null,
  },
  queue: {
    assigned_count: 0,
    active_holding: 0,
    callback_holding: 0,
    stale_holding: 0,
    overdue_callbacks: 0,
  },
  shift_activity: [],
  shift_activity_label: "All Contacts Processed Today",
  attention: [],
  health: {
    productivity_state: "low",
    productivity_label: "Low progress",
    queue_state: "healthy",
    queue_label: "Queue healthy",
  },
  shift: {
    current_shift: "OUTSIDE_SHIFT",
    current_shift_label: "Outside shift",
    shift_start_iso: null,
    shift_end_iso: null,
    shift_active: false,
  },
  shift_progress: {
    shift_1_target: 100,
    shift_2_target: 100,
    day_target: 200,
    shift_1_processed: 0,
    shift_2_processed: 0,
    day_processed: 0,
    current_shift_target: 0,
    current_shift_processed: 0,
    current_shift_progress_pct: 0,
    shift_1_progress_pct: 0,
    shift_2_progress_pct: 0,
    day_progress_pct: 0,
    remaining_to_current_shift: 0,
    remaining_to_day: 200,
  },
  campaign_rank: {
    by_kpi_today_rank: null,
    by_conversion_rank: null,
    team_size: 0,
  },
  team_average: {
    avg_kpi_today: 0,
    avg_done_total: 0,
    avg_conversion_rate: 0,
  },
  weekly_trend: [],
  kpi: {
    kpi_today: 0,
    kpi_total: 0,
  },
};

function filterShiftActivity(
  rows: TeleShiftActivityRow[],
  statusFilter: ActivityFilter,
  kpiFilter: KpiFilter,
  keyword: string
) {
  const q = keyword.trim().toLowerCase();

  return rows.filter((row) => {
    const status = String(row.final_status ?? "").trim().toUpperCase();

    if (statusFilter !== "ALL" && status !== statusFilter) {
      return false;
    }

    if (kpiFilter === "KPI_ONLY" && !row.is_kpi_eligible) {
      return false;
    }

    if (kpiFilter === "NON_KPI" && row.is_kpi_eligible) {
      return false;
    }

    if (!q) return true;

    const haystack = [
      row.customer_name ?? "",
      row.company_name ?? "",
      row.person_id ?? "",
      row.telephone_number ?? "",
      row.mobile_number ?? "",
      row.group_name ?? "",
      row.detail_name ?? "",
      row.note_text ?? "",
      row.final_status ?? "",
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(q);
  });
}

export default function TeleDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const [uid, setUid] = useState<string | null>(null);
  const [campaignOptions, setCampaignOptions] = useState<CampaignOption[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");

  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("ALL");
  const [kpiFilter, setKpiFilter] = useState<KpiFilter>("ALL");
  const [activityKeyword, setActivityKeyword] = useState("");

  const [data, setData] = useState<TeleDashboardData>(EMPTY_DATA);

  const loadEverything = useCallback(
    async (mode: "initial" | "refresh" = "initial", forcedCampaignId?: string) => {
      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);
      setErrorText("");

      try {
        const me = uid ?? (await getCurrentTeleUserId());
        if (!uid) setUid(me);

        const options = await loadCampaignOptionsForTele(me);
        setCampaignOptions(options);

        const inferred =
          forcedCampaignId ||
          selectedCampaignId ||
          (await inferActiveCampaignId(me)) ||
          options[0]?.id ||
          "";

        if (!inferred) {
          setSelectedCampaignId("");
          setData(EMPTY_DATA);
          setLastUpdatedAt(new Date().toISOString());
          return;
        }

        if (selectedCampaignId !== inferred) {
          setSelectedCampaignId(inferred);
        }

        const dashboardData = await loadTeleDashboardData(me, inferred);
        setData(dashboardData);
        setLastUpdatedAt(new Date().toISOString());
      } catch (e: any) {
        console.error(e);
        setErrorText(e?.message ?? "Failed to load tele dashboard");
      } finally {
        if (mode === "initial") setLoading(false);
        if (mode === "refresh") setRefreshing(false);
      }
    },
    [uid, selectedCampaignId]
  );

  useEffect(() => {
    void loadEverything("initial");
  }, [loadEverything]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadEverything("refresh");
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [loadEverything]);

  const weeklyMax = useMemo(() => {
    return Math.max(
      1,
      ...data.weekly_trend.map((x) => Math.max(x.calls, x.done, x.terminal, x.kpi))
    );
  }, [data.weekly_trend]);

  const tone = useMemo(() => healthToneClass(data.health), [data.health]);

  const filteredShiftActivity = useMemo(() => {
    return filterShiftActivity(data.shift_activity, activityFilter, kpiFilter, activityKeyword);
  }, [data.shift_activity, activityFilter, kpiFilter, activityKeyword]);

  const activityCountSummary = useMemo(() => {
    const all = data.shift_activity.length;
    const done = data.shift_activity.filter(
      (x) => String(x.final_status ?? "").toUpperCase() === "DONE"
    ).length;
    const invalid = data.shift_activity.filter(
      (x) => String(x.final_status ?? "").toUpperCase() === "INVALID"
    ).length;
    const callback = data.shift_activity.filter(
      (x) => String(x.final_status ?? "").toUpperCase() === "CALLBACK"
    ).length;
    const kpiEligible = data.shift_activity.filter((x) => x.is_kpi_eligible).length;

    return { all, done, invalid, callback, kpiEligible };
  }, [data.shift_activity]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="h-6 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {errorText ? (
        <Card className="border-destructive/40">
          <CardContent className="py-4 text-sm text-destructive">{errorText}</CardContent>
        </Card>
      ) : null}

      <Card className={tone}>
        <CardContent className="py-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="text-sm font-semibold uppercase tracking-wide">
                Tele Performance Dashboard
              </div>

              <div className="mt-1 text-lg font-semibold">
                {data.campaign?.campaign_name || "No active campaign"}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm opacity-80">
                {data.campaign?.status ? <Badge variant="outline">{data.campaign.status}</Badge> : null}
                {data.campaign?.filename ? <Badge variant="outline">{data.campaign.filename}</Badge> : null}
                <span>{data.shift.current_shift_label}</span>
                <span>•</span>
                <span>{data.health.productivity_label}</span>
                <span>•</span>
                <span>{data.health.queue_label}</span>
              </div>

              <div className="mt-2 text-sm opacity-75">
                {data.campaign?.description?.trim() || "No campaign description."}
              </div>
            </div>

            <div className="flex flex-col gap-2 xl:items-end">
              <div className="w-[280px]">
                <Select
                  value={selectedCampaignId}
                  onValueChange={(v) => {
                    setSelectedCampaignId(v);
                    void loadEverything("refresh", v);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    {campaignOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.campaign_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="text-right text-xs opacity-80">
                <div>Last updated</div>
                <div className="font-medium">{lastUpdatedAt ? fmtDT(lastUpdatedAt) : "—"}</div>
              </div>

              <div className="flex gap-2">
                <Link href="/tele/workspace">
                  <Button variant="outline" size="sm">Open Workspace</Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void loadEverything("refresh", selectedCampaignId)}
                  disabled={refreshing}
                >
                  {refreshing ? "Refreshing..." : "Refresh Dashboard"}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Current Shift KPI">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="opacity-70">Current shift KPI progress</span>
                <span className="font-medium">
                  {data.shift_progress.current_shift_processed}/{data.shift_progress.current_shift_target || 100}
                </span>
              </div>
              <ProgressBar value={data.shift_progress.current_shift_progress_pct} />
              <div className="mt-2 text-xs opacity-70">
                {data.shift.shift_active
                  ? `Remaining to current shift KPI: ${data.shift_progress.remaining_to_current_shift}`
                  : "Current time is outside defined shift windows."}
              </div>
            </div>

            <div className="rounded-xl border p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="opacity-70">Daily KPI progress</span>
                <span className="font-medium">
                  {data.shift_progress.day_processed}/{data.shift_progress.day_target}
                </span>
              </div>
              <ProgressBar value={data.shift_progress.day_progress_pct} />
              <div className="mt-2 text-xs opacity-70">
                Remaining to daily KPI: {data.shift_progress.remaining_to_day}
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Shift Breakdown">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <MiniStat label="Shift 1 Target" value={data.shift_progress.shift_1_target} />
            <MiniStat label="Shift 1 KPI" value={data.shift_progress.shift_1_processed} />
            <MiniStat label="Shift 2 Target" value={data.shift_progress.shift_2_target} />
            <MiniStat label="Shift 2 KPI" value={data.shift_progress.shift_2_processed} />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border p-4">
              <div className="text-sm font-medium">Shift 1 (09:00–12:30)</div>
              <ProgressBar value={data.shift_progress.shift_1_progress_pct} />
              <div className="mt-2 text-xs opacity-70">
                {pct(data.shift_progress.shift_1_progress_pct)}
              </div>
            </div>

            <div className="rounded-xl border p-4">
              <div className="text-sm font-medium">Shift 2 (13:00–18:00)</div>
              <ProgressBar value={data.shift_progress.shift_2_progress_pct} />
              <div className="mt-2 text-xs opacity-70">
                {pct(data.shift_progress.shift_2_progress_pct)}
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Campaign Progress">
          {!data.progress ? (
            <div className="text-sm opacity-70">Campaign progress not available.</div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <MiniStat label="Total Contacts" value={data.progress.total_contacts} />
              <MiniStat label="Done Contacts" value={data.progress.done_contacts} />
              <MiniStat label="Remaining" value={data.progress.remaining_contacts} />
              <MiniStat label="Campaign Done %" value={pct(data.progress.done_percent)} />
              <MiniStat label="Available Now" value={data.progress.available_now} />
              <MiniStat label="My Holding" value={data.progress.my_holding} />
              <MiniStat label="Other Holding" value={data.progress.other_holding} />
              <MiniStat label="Capacity Left" value={data.progress.capacity_left} />
            </div>
          )}
        </SectionCard>

        <SectionCard title="My Rank in This Campaign Team">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <MiniStat
              label="KPI Today Rank"
              value={
                data.campaign_rank.by_kpi_today_rank && data.campaign_rank.team_size
                  ? `#${data.campaign_rank.by_kpi_today_rank}/${data.campaign_rank.team_size}`
                  : "—"
              }
            />
            <MiniStat
              label="Conversion Rank"
              value={
                data.campaign_rank.by_conversion_rank && data.campaign_rank.team_size
                  ? `#${data.campaign_rank.by_conversion_rank}/${data.campaign_rank.team_size}`
                  : "—"
              }
            />
            <MiniStat label="Team Size" value={data.campaign_rank.team_size} />
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="My KPI Today">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <MiniStat label="Calls Today" value={data.summary.calls_today} />
            <MiniStat label="KPI Today" value={data.kpi.kpi_today} />
            <MiniStat label="Done Today" value={data.summary.done_today} />
            <MiniStat label="Invalid Today" value={data.summary.invalid_today} />
            <MiniStat label="Callback Today" value={data.summary.callback_today} />
            <MiniStat label="Last Call" value={fmtDT(data.summary.last_call_at)} />
          </div>
        </SectionCard>

        <SectionCard title="Team Average Comparison">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <MiniStat
              label="My KPI Today / Team Avg"
              value={`${data.kpi.kpi_today} / ${data.team_average.avg_kpi_today}`}
            />
            <MiniStat
              label="My Done Total / Team Avg"
              value={`${data.summary.done_total} / ${data.team_average.avg_done_total}`}
            />
            <MiniStat
              label="My Conversion / Team Avg"
              value={`${pct(data.summary.conversion_rate)} / ${pct(data.team_average.avg_conversion_rate)}`}
            />
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="My Campaign KPI">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <MiniStat label="KPI Total" value={data.kpi.kpi_total} />
            <MiniStat label="Total Calls" value={data.summary.total_calls} />
            <MiniStat label="Done Total" value={data.summary.done_total} />
            <MiniStat label="Invalid Total" value={data.summary.invalid_total} />
            <MiniStat label="Callback Total" value={data.summary.callback_total} />
            <MiniStat label="Conversion %" value={pct(data.summary.conversion_rate)} />
          </div>
        </SectionCard>

        <SectionCard title="My Queue Health">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <MiniStat label="Assigned Count" value={data.queue.assigned_count} />
            <MiniStat label="Active Holding" value={data.queue.active_holding} />
            <MiniStat label="Callback Holding" value={data.queue.callback_holding} />
            <MiniStat label="Stale Holding" value={data.queue.stale_holding} />
            <MiniStat label="Overdue Callback" value={data.queue.overdue_callbacks} />
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Next Actions">
          {data.attention.length === 0 ? (
            <div className="text-sm opacity-70">No immediate action needed.</div>
          ) : (
            <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
              {data.attention.map((item, idx) => (
                <div
                  key={idx}
                  className={`rounded-xl border p-4 ${
                    item.tone === "danger"
                      ? "border-destructive/40"
                      : item.tone === "warn"
                      ? "border-amber-500/30"
                      : item.tone === "good"
                      ? "border-emerald-500/30"
                      : ""
                  }`}
                >
                  <div className="text-sm font-medium">{item.title}</div>
                  <div className="mt-1 text-sm opacity-70">{item.detail}</div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Weekly Trend">
          {data.weekly_trend.length === 0 ? (
            <div className="text-sm opacity-70">No weekly trend data found.</div>
          ) : (
            <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
              {data.weekly_trend.map((row) => (
                <div key={row.date_label} className="rounded-xl border p-3">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium">{row.date_label}</span>
                    <span className="opacity-70">
                      {row.calls} calls • {row.kpi} KPI • {row.done} done • {row.terminal} terminal
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <div className="mb-1 text-[11px] opacity-60">Calls</div>
                      <TrendBar value={row.calls} max={weeklyMax} />
                    </div>

                    <div>
                      <div className="mb-1 text-[11px] opacity-60">KPI</div>
                      <TrendBar value={row.kpi} max={weeklyMax} />
                    </div>

                    <div>
                      <div className="mb-1 text-[11px] opacity-60">Done</div>
                      <TrendBar value={row.done} max={weeklyMax} />
                    </div>

                    <div>
                      <div className="mb-1 text-[11px] opacity-60">Terminal</div>
                      <TrendBar value={row.terminal} max={weeklyMax} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title={data.shift_activity_label}
        action={
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <div className="w-[150px]">
              <Select
                value={activityFilter}
                onValueChange={(v) => setActivityFilter(v as ActivityFilter)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value="DONE">DONE</SelectItem>
                  <SelectItem value="INVALID">INVALID</SelectItem>
                  <SelectItem value="CALLBACK">CALLBACK</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-[150px]">
              <Select
                value={kpiFilter}
                onValueChange={(v) => setKpiFilter(v as KpiFilter)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="KPI filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value="KPI_ONLY">KPI only</SelectItem>
                  <SelectItem value="NON_KPI">Non-KPI</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-[240px]">
              <Input
                placeholder="Search name / company / phone / note..."
                value={activityKeyword}
                onChange={(e) => setActivityKeyword(e.target.value)}
              />
            </div>
          </div>
        }
      >
        <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-6">
          <MiniStat label="All" value={activityCountSummary.all} />
          <MiniStat label="KPI Eligible" value={activityCountSummary.kpiEligible} />
          <MiniStat label="DONE" value={activityCountSummary.done} />
          <MiniStat label="INVALID" value={activityCountSummary.invalid} />
          <MiniStat label="CALLBACK" value={activityCountSummary.callback} />
          <MiniStat label="Filtered" value={filteredShiftActivity.length} />
        </div>

        {filteredShiftActivity.length === 0 ? (
          <div className="text-sm opacity-70">No processed contacts found for this filter.</div>
        ) : (
          <div className="max-h-[620px] space-y-3 overflow-y-auto pr-1">
            {filteredShiftActivity.map((item) => (
              <div key={item.call_log_id} className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">
                      {item.customer_name ?? "Unknown"}
                    </div>

                    <div className="mt-1 text-xs text-muted-foreground">
                      Tel/Mobile: {buildActivityPhones(item)}
                    </div>

                    <div className="mt-1 text-xs text-muted-foreground">
                      {item.company_name ?? "—"}
                    </div>

                    <div className="mt-1 text-xs opacity-70">{fmtDT(item.called_at)}</div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <div>{finalStatusBadge(item.final_status)}</div>
                    {item.is_kpi_eligible ? (
                      <Badge variant="outline">KPI</Badge>
                    ) : (
                      <Badge variant="secondary">Non-KPI</Badge>
                    )}
                  </div>
                </div>

                <div className="mt-2 text-sm opacity-80">
                  {item.group_name || "—"}
                  {item.detail_name ? ` · ${item.detail_name}` : ""}
                </div>

                <div className="mt-2 text-xs opacity-60 whitespace-pre-wrap">
                  {item.note_text || "No note"}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}