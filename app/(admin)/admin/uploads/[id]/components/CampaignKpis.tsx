"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { UploadDetailVM } from "../hooks/useUploadDetail";
import { toCSV, downloadText } from "@/lib/crm/export";
import { supabase } from "@/lib/supabase/client";
import { clamp } from "../lib/utils";

export default function CampaignKpis({ vm }: { vm: UploadDetailVM }) {
  const u = vm.upload!;
  const k = vm.kpis;

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

  const denom = k.total || 0;
  const progressPct = denom ? clamp(Math.round((k.terminal / denom) * 100), 0, 100) : 0;

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border p-3">
            <div className="text-xs opacity-60">Declared Rows</div>
            <div className="text-2xl font-semibold tabular-nums">{u.total_rows}</div>
          </div>

          <div className="rounded-lg border p-3">
            <div className="text-xs opacity-60">Contacts in DB</div>
            <div className="text-2xl font-semibold tabular-nums">{k.total}</div>
          </div>

          <div className="rounded-lg border p-3">
            <div className="text-xs opacity-60">Terminal (DONE + INVALID)</div>
            <div className="text-2xl font-semibold tabular-nums">{k.terminal}</div>
          </div>

          <div className="rounded-lg border p-3">
            <div className="text-xs opacity-60">Progress</div>
            <div className="text-2xl font-semibold tabular-nums">{progressPct}%</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="opacity-70">Queue health</div>
            <div className="tabular-nums opacity-70">
              Locked {k.locked} • Expired assigned {k.expired_assigned} • Unassigned {k.unassigned} • Available {k.available}
            </div>
          </div>
          <div className="h-2 w-full rounded-full bg-muted">
            <div className="h-2 rounded-full bg-foreground" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

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