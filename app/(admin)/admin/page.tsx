"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase/client";

import type { AdminDashboardData } from "./_lib/dashboard.types";
import { fetchAdminDashboard } from "./_lib/dashboard.api";
import { buildNeedsAttention, getTopCampaignByIssues } from "./_lib/dashboard.utils";

import { DashboardHeader } from "./_components/dashboard-header";
import { DashboardHealthBanner } from "./_components/dashboard-health-banner";
import { DashboardKpis } from "./_components/dashboard-kpis";
import { DashboardOverview } from "./_components/dashboard-overview";
import { DashboardCampaigns } from "./_components/dashboard-campaigns";
import { DashboardAttention } from "./_components/dashboard-attention";
import { DashboardTeam } from "./_components/dashboard-team";
import { DashboardActivity } from "./_components/dashboard-activity";
import { DashboardAudit } from "./_components/dashboard-audit";

const AUTO_REFRESH_MS = 60_000;

export default function AdminHomePage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cleaningLeases, setCleaningLeases] = useState(false);

  const [errorText, setErrorText] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const [data, setData] = useState<AdminDashboardData>({
    summary: null,
    campaigns: [],
    team: [],
    auditSummary: null,
    auditTopUploads: [],
    recentActivity: [],
  });

  const loadDashboard = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") setLoading(true);
    if (mode === "refresh") setRefreshing(true);

    setErrorText("");

    try {
      const res = await fetchAdminDashboard();
      setData(res);
      setLastUpdatedAt(new Date().toISOString());
    } catch (e: any) {
      console.error(e);
      setErrorText(e?.message ?? "Failed to load admin dashboard");
    } finally {
      if (mode === "initial") setLoading(false);
      if (mode === "refresh") setRefreshing(false);
    }
  }, []);

  const handleCleanupExpiredLeases = useCallback(async () => {
    setActionMessage("");
    setActionError("");
    setCleaningLeases(true);

    try {
      const { data: cleanedCount, error } = await supabase.rpc("rpc_cleanup_expired_leases", {
        p_upload_id: null,
        p_limit: 5000,
      });

      if (error) throw error;

      const count = Number(cleanedCount ?? 0);

      setActionMessage(
        count > 0
          ? `Cleanup completed successfully. ${count} expired lease(s) were released.`
          : "Cleanup completed successfully. No expired leases were found."
      );

      await loadDashboard("refresh");
    } catch (e: any) {
      console.error(e);
      setActionError(e?.message ?? "Failed to cleanup expired leases");
    } finally {
      setCleaningLeases(false);
    }
  }, [loadDashboard]);

  useEffect(() => {
    loadDashboard("initial");
  }, [loadDashboard]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && !cleaningLeases) {
        loadDashboard("refresh");
      }
    }, AUTO_REFRESH_MS);

    return () => clearInterval(timer);
  }, [loadDashboard, cleaningLeases]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && !cleaningLeases) {
        loadDashboard("refresh");
      }
    };

    const onFocus = () => {
      if (document.visibilityState === "visible" && !cleaningLeases) {
        loadDashboard("refresh");
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [loadDashboard, cleaningLeases]);

  useEffect(() => {
    if (!actionMessage) return;

    const t = window.setTimeout(() => {
      setActionMessage("");
    }, 5000);

    return () => window.clearTimeout(t);
  }, [actionMessage]);

  useEffect(() => {
    if (!actionError) return;

    const t = window.setTimeout(() => {
      setActionError("");
    }, 7000);

    return () => window.clearTimeout(t);
  }, [actionError]);

  useEffect(() => {
    if (!errorText) return;

    const t = window.setTimeout(() => {
      setErrorText("");
    }, 7000);

    return () => window.clearTimeout(t);
  }, [errorText]);

  const needsAttention = useMemo(
    () => buildNeedsAttention(data.summary),
    [data.summary]
  );

  const topIssueCampaign = useMemo(
    () => getTopCampaignByIssues(data.campaigns),
    [data.campaigns]
  );

  if (loading && !data.summary) {
    return (
      <div className="space-y-6">
        <DashboardHeader
          lastUpdatedAt={lastUpdatedAt}
          refreshing={refreshing}
          cleaningLeases={cleaningLeases}
          onRefresh={() => loadDashboard("refresh")}
          onCleanupExpiredLeases={handleCleanupExpiredLeases}
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm opacity-60">Loading...</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-8 rounded bg-muted animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (errorText && !data.summary) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="py-6">
          <div className="text-lg font-semibold">Dashboard failed to load</div>
          <div className="mt-2 text-sm text-destructive">{errorText}</div>
        </CardContent>
      </Card>
    );
  }

  if (!data.summary) {
    return (
      <Card>
        <CardContent className="py-6 text-sm opacity-70">
          No dashboard data available.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <DashboardHeader
        lastUpdatedAt={lastUpdatedAt}
        refreshing={refreshing}
        cleaningLeases={cleaningLeases}
        onRefresh={() => loadDashboard("refresh")}
        onCleanupExpiredLeases={handleCleanupExpiredLeases}
      />

      {errorText ? (
        <Card className="border-destructive/40">
          <CardContent className="py-4 text-sm text-destructive">
            {errorText}
          </CardContent>
        </Card>
      ) : null}

      {actionMessage ? (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="py-4 text-sm text-emerald-700 dark:text-emerald-300">
            {actionMessage}
          </CardContent>
        </Card>
      ) : null}

      {actionError ? (
        <Card className="border-destructive/40">
          <CardContent className="py-4 text-sm text-destructive">
            {actionError}
          </CardContent>
        </Card>
      ) : null}

      <DashboardHealthBanner summary={data.summary} />
      <DashboardKpis summary={data.summary} />
      <DashboardOverview summary={data.summary} />

      <div className="grid gap-4 xl:grid-cols-2 items-start">
        <DashboardCampaigns campaigns={data.campaigns} />
        <DashboardAttention
          items={needsAttention}
          topIssueCampaign={topIssueCampaign}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2 items-start">
        <DashboardTeam team={data.team} />
        <DashboardActivity recentActivity={data.recentActivity} />
      </div>

      <DashboardAudit
        auditSummary={data.auditSummary}
        auditTopUploads={data.auditTopUploads}
      />
    </div>
  );
}