"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { UploadDetailVM } from "../hooks/useUploadDetail";
import { toCSV, downloadText } from "@/lib/crm/export";
import { supabase } from "@/lib/supabase/client";
import { clamp } from "../lib/utils";

function fmt(n: number) {
  return Number.isFinite(n) ? n.toLocaleString() : "0";
}
function pct(n: number) {
  return `${clamp(Math.round(n), 0, 100)}%`;
}
function safeDiv(a: number, b: number) {
  if (!b) return 0;
  return a / b;
}

export default function CampaignKpis({ vm }: { vm: UploadDetailVM }) {
  const u = vm.upload!;
  const k = vm.kpis;

  const derived = useMemo(() => {
    const declared = Number(u.total_rows ?? 0);
    const total = Number(k.total ?? 0);
    const terminal = Number(k.terminal ?? 0);
    const inProgress = Number(k.in_progress ?? Math.max(total - terminal, 0));

    // queue state
    const locked = Number(k.locked ?? 0);
    const expired = Number(k.expired_assigned ?? 0);
    const unassigned = Number(k.unassigned ?? 0);
    const available = Number(k.available ?? Math.max(inProgress - locked, 0));

    // progress
    const progress = total ? clamp(Math.round((terminal / total) * 100), 0, 100) : 0;

    // utilization / bottleneck
    const lockedRate = inProgress ? clamp(Math.round((locked / inProgress) * 100), 0, 100) : 0;
    const availableRate = inProgress ? clamp(Math.round((available / inProgress) * 100), 0, 100) : 0;

    const importOk = declared === 0 ? true : declared === total;
    const importDelta = declared - total;

    // suggested status (do NOT auto change, just insight)
    const canComplete = total > 0 && terminal === total;
    const isBlocked = inProgress > 0 && available === 0 && locked > 0;
    const hasWork = inProgress > 0;

    const headline = (() => {
      if (canComplete) return { tone: "ok" as const, text: "✅ All contacts are terminal. You can mark campaign as COMPLETED/DONE." };
      if (isBlocked) return { tone: "warn" as const, text: "⚠ Queue blocked: all remaining contacts are LOCKED (0 available)." };
      if (hasWork && available > 0) return { tone: "ok" as const, text: `✅ ${fmt(available)} contacts available to call now.` };
      if (total === 0) return { tone: "muted" as const, text: "No contacts loaded yet." };
      return { tone: "muted" as const, text: "Campaign is running." };
    })();

    const importMsg = (() => {
      if (importOk) return null;
      if (declared === 0) return null;
      if (importDelta > 0)
        return `⚠ Imported fewer than declared: missing ${fmt(importDelta)} rows (dedupe/invalid rows?).`;
      return `⚠ Imported more than declared: extra ${fmt(Math.abs(importDelta))} rows (duplicates?).`;
    })();

    return {
      declared,
      total,
      terminal,
      inProgress,
      locked,
      expired,
      unassigned,
      available,
      progress,
      lockedRate,
      availableRate,
      importOk,
      importMsg,
      headline,
    };
  }, [u.total_rows, k]);

  const exportReport = async () => {
    vm.setExportingReport(true);
    try {
      const { data, error } = await supabase.from("v_contacts_report").select("*").eq("upload_id", vm.uploadId);
      if (error) throw error;
      const csv = toCSV((data as any[]) ?? []);
      const filename = `${u.campaign_name ?? "report"}_${vm.uploadId}.csv`.replace(/[^\w\-]+/g, "_");
      downloadText(filename, csv);
    } catch (e: any) {
      alert(e?.message ?? "Export failed");
    } finally {
      vm.setExportingReport(false);
    }
  };

  const exportLogs = async () => {
    vm.setExportingLogs(true);
    try {
      const { data, error } = await supabase
        .from("v_call_logs_export")
        .select("*")
        .eq("upload_id", vm.uploadId)
        .order("called_at", { ascending: true });

      if (error) throw error;
      const csv = toCSV((data as any[]) ?? []);
      const filename = `${u.campaign_name ?? "call_logs"}_${vm.uploadId}.csv`.replace(/[^\w\-]+/g, "_");
      downloadText(filename, csv);
    } catch (e: any) {
      alert(e?.message ?? "Export failed");
    } finally {
      vm.setExportingLogs(false);
    }
  };

  const progressBarWidth = `${derived.progress}%`;

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        {/* ===== Headline insight ===== */}
        <div
          className={[
            "rounded-lg border p-3 text-sm",
            derived.headline.tone === "ok" ? "bg-emerald-50/40" : "",
            derived.headline.tone === "warn" ? "bg-amber-50/40" : "",
            derived.headline.tone === "muted" ? "bg-muted/20" : "",
          ].join(" ")}
        >
          <div className="font-medium">{derived.headline.text}</div>
          {derived.importMsg ? <div className="mt-1 text-xs opacity-70">{derived.importMsg}</div> : null}
        </div>

        {/* ===== KPI Cards (production-grade) ===== */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Contacts */}
          <div className="rounded-lg border p-3">
            <div className="text-xs opacity-60">Contacts (DB / Declared)</div>
            <div className="text-2xl font-semibold tabular-nums">
              {fmt(derived.total)}
              <span className="text-sm font-normal opacity-60"> / {fmt(derived.declared)}</span>
            </div>
            <div className="mt-1 text-xs opacity-70">
              {derived.declared === 0 ? "Declared unknown" : derived.importOk ? "Import aligned" : "Import mismatch"}
            </div>
          </div>

          {/* Completed */}
          <div className="rounded-lg border p-3">
            <div className="text-xs opacity-60">Completed (DONE + INVALID)</div>
            <div className="text-2xl font-semibold tabular-nums">{fmt(derived.terminal)}</div>
            <div className="mt-1 text-xs opacity-70">
              Completion rate: <span className="tabular-nums">{pct(derived.progress)}</span>
            </div>
          </div>

          {/* Remaining */}
          <div className="rounded-lg border p-3">
            <div className="text-xs opacity-60">Remaining (In progress)</div>
            <div className="text-2xl font-semibold tabular-nums">{fmt(derived.inProgress)}</div>
            <div className="mt-1 text-xs opacity-70">
              Locked share: <span className="tabular-nums">{pct(derived.lockedRate)}</span>
            </div>
          </div>

          {/* Available Now */}
          <div className="rounded-lg border p-3">
            <div className="text-xs opacity-60">Available to call now</div>
            <div className="text-2xl font-semibold tabular-nums">{fmt(derived.available)}</div>
            <div className="mt-1 text-xs opacity-70">
              Availability: <span className="tabular-nums">{pct(derived.availableRate)}</span>
            </div>
          </div>
        </div>

        {/* ===== Queue health + progress bar ===== */}
        <div className="space-y-2">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between text-sm">
            <div className="opacity-70">Queue health</div>

            <div className="tabular-nums opacity-70">
              Locked {fmt(derived.locked)} • Expired {fmt(derived.expired)} • Unassigned {fmt(derived.unassigned)} • Available{" "}
              {fmt(derived.available)}
            </div>
          </div>

          <div className="h-2 w-full rounded-full bg-muted">
            <div className="h-2 rounded-full bg-foreground" style={{ width: progressBarWidth }} />
          </div>

          {/* micro hints */}
          <div className="text-xs opacity-70">
            {derived.inProgress > 0 ? (
              <>
                Tip: “Locked” means assigned + lease active; “Available” means ready for tele pull/call. If Available stays 0 while Remaining &gt; 0, it’s
                a bottleneck (leases too long, tele not submitting calls, or stuck assignments).
              </>
            ) : (
              <>All contacts are terminal. Consider marking the campaign as COMPLETED/DONE.</>
            )}
          </div>
        </div>

        {/* ===== Actions ===== */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportReport} disabled={vm.exportingReport || vm.exportingLogs || vm.loading}>
            {vm.exportingReport ? "Exporting..." : "Export Report"}
          </Button>
          <Button variant="outline" onClick={exportLogs} disabled={vm.exportingLogs || vm.exportingReport || vm.loading}>
            {vm.exportingLogs ? "Exporting..." : "Export Call Logs"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}