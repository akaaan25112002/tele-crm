"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getCurrentTeleUserId,
  inferActiveCampaignId,
  loadTeleDashboardData,
} from "../dashboard/tele-dashboard.data";
import type { TeleDashboardData } from "../dashboard/tele-dashboard.types";
import { fmtDT, healthToneClass, pct } from "../dashboard/tele-dashboard.utils";

const AUTO_REFRESH_MS = 60_000;

type Props = {
  refreshToken?: number;
};

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

function Chip(props: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border px-3 py-2">
      <div className="text-[11px] opacity-60">{props.label}</div>
      <div className="mt-1 text-sm font-semibold tabular-nums">{props.value}</div>
    </div>
  );
}

export default function TeleWorkspaceCompactSummary({ refreshToken = 0 }: Props) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [data, setData] = useState<TeleDashboardData>(EMPTY_DATA);

  const loadCompact = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") setLoading(true);
    if (mode === "refresh") setRefreshing(true);
    setErrorText("");

    try {
      const uid = await getCurrentTeleUserId();
      const activeCampaignId = await inferActiveCampaignId(uid);

      if (!activeCampaignId) {
        setData(EMPTY_DATA);
        setLastUpdatedAt(new Date().toISOString());
        return;
      }

      const dashboardData = await loadTeleDashboardData(uid, activeCampaignId);
      setData(dashboardData);
      setLastUpdatedAt(new Date().toISOString());
    } catch (e: any) {
      console.error(e);
      setErrorText(e?.message ?? "Failed to load workspace summary");
    } finally {
      if (mode === "initial") setLoading(false);
      if (mode === "refresh") setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadCompact("initial");
  }, [loadCompact]);

  useEffect(() => {
    if (!refreshToken) return;
    void loadCompact("refresh");
  }, [refreshToken, loadCompact]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadCompact("refresh");
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [loadCompact]);

  const tone = useMemo(() => healthToneClass(data.health), [data.health]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="h-6 rounded bg-muted animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={tone}>
      <CardContent className="py-4">
        {errorText ? (
          <div className="mb-3 rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive">
            {errorText}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-wide">Workspace Summary</div>
            <div className="mt-1 text-sm font-medium">
              {data.campaign?.campaign_name || "No active campaign"}
            </div>
            <div className="mt-1 text-sm opacity-80">
              {data.shift.current_shift_label} • {data.health.productivity_label} • {data.health.queue_label}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/tele/dashboard">
              <Button variant="outline" size="sm">Open Full Dashboard</Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadCompact("refresh")}
              disabled={refreshing}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Chip label="Current Shift" value={data.shift.current_shift_label} />
          <Chip
            label="Current Shift KPI"
            value={
              data.shift.shift_active
                ? `${data.shift_progress.current_shift_processed}/${data.shift_progress.current_shift_target}`
                : "—"
            }
          />
          <Chip
            label="Current Shift %"
            value={data.shift.shift_active ? pct(data.shift_progress.current_shift_progress_pct) : "—"}
          />
          <Chip label="Day KPI" value={`${data.shift_progress.day_processed}/${data.shift_progress.day_target}`} />
          <Chip label="Day %" value={pct(data.shift_progress.day_progress_pct)} />
          <Chip label="Overdue Callback" value={data.queue.overdue_callbacks} />
        </div>

        <div className="mt-3 text-xs opacity-70">
          Last updated: {lastUpdatedAt ? fmtDT(lastUpdatedAt) : "—"}
        </div>
      </CardContent>
    </Card>
  );
}