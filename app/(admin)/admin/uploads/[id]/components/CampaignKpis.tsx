"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { UploadDetailVM } from "../hooks/useUploadDetail";
import { fetchAllByRange, downloadWorkbookXlsx } from "@/lib/crm/export";
import { supabase } from "@/lib/supabase/client";
import { clamp } from "../lib/utils";

function fmt(n: number) {
  return Number.isFinite(n) ? n.toLocaleString() : "0";
}

function pct(n: number) {
  return `${clamp(Math.round(n), 0, 100)}%`;
}

function safeFileBaseName(name: string) {
  return String(name ?? "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w\-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

function normalizeByHeaders(rows: any[], headers: readonly string[]) {
  return (rows ?? []).map((r) => {
    const out: Record<string, any> = {};
    for (const h of headers) out[h] = r?.[h] ?? "";
    return out;
  });
}

export default function CampaignKpis({ vm }: { vm: UploadDetailVM }) {
  const u = vm.upload!;
  const k = vm.kpis;

  const [exportingExcel, setExportingExcel] = useState(false);

  const derived = useMemo(() => {
    const declared = Number(u.total_rows ?? 0);
    const total = Number(k.total ?? 0);
    const terminal = Number(k.terminal ?? 0);
    const inProgress = Number(k.in_progress ?? Math.max(total - terminal, 0));

    const locked = Number(k.locked ?? 0);
    const expired = Number(k.expired_assigned ?? 0);
    const unassigned = Number(k.unassigned ?? 0);
    const available = Number(k.available ?? Math.max(inProgress - locked, 0));

    const progress = total ? clamp(Math.round((terminal / total) * 100), 0, 100) : 0;
    const lockedRate = inProgress ? clamp(Math.round((locked / inProgress) * 100), 0, 100) : 0;
    const availableRate = inProgress ? clamp(Math.round((available / inProgress) * 100), 0, 100) : 0;

    const importOk = declared === 0 ? true : declared === total;
    const importDelta = declared - total;

    const canComplete = total > 0 && terminal === total;
    const isBlocked = inProgress > 0 && available === 0 && locked > 0;
    const hasWork = inProgress > 0;

    const headline = (() => {
      if (canComplete) {
        return {
          tone: "ok" as const,
          text: "✅ All contacts are terminal. You can mark campaign as COMPLETED/DONE.",
        };
      }
      if (isBlocked) {
        return {
          tone: "warn" as const,
          text: "⚠ Queue blocked: all remaining contacts are LOCKED (0 available).",
        };
      }
      if (hasWork && available > 0) {
        return {
          tone: "ok" as const,
          text: `✅ ${fmt(available)} contacts available to call now.`,
        };
      }
      if (total === 0) {
        return {
          tone: "muted" as const,
          text: "No contacts loaded yet.",
        };
      }
      return {
        tone: "muted" as const,
        text: "Campaign is running.",
      };
    })();

    const importMsg = (() => {
      if (importOk) return null;
      if (declared === 0) return null;
      if (importDelta > 0) {
        return `⚠ Imported fewer than declared: missing ${fmt(importDelta)} rows.`;
      }
      return `⚠ Imported more than declared: extra ${fmt(Math.abs(importDelta))} rows.`;
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
      importMsg,
      headline,
    };
  }, [u.total_rows, k]);

  const CONTACT_HEADERS = [
    "Person ID",
    "Company Info",
    "Company Name",
    "Given Name",
    "Family Name",
    "Job Title",
    "Department",
    "Country",
    "Email",
    "Email (Second)",
    "Telephone Number",
    "Mobile Number",
    "Address-Line1",
    "City",
    "State",
    "Registered Event",
    "Visited Event",
    "Current Status",
    "Assigned Tele ID",
    "Assigned Tele Name",
    "Assigned At",
    "Lease Expires At",
    "Call Attempts",
    "Last Action At",
    "Updated At",
    "Total Calls",
    "First Call At",
    "Last Call At",
    "Last Called At",
    "Next Call At",
    "Last Note",
    "Last Result Group",
    "Last Result Detail",
    "Last Result Final Status",
    "Last Result Is Terminal",
    "Last Caller ID",
    "Last Caller Name",
    "Edited Fields Count",
    "Last Edited At",
    "Last Edited By ID",
    "Last Edited By Name",
    "Edited Fields List",
  ] as const;

  const LOG_HEADERS = [
    "Called At",
    "Next Call At",
    "Note",
    "Campaign Name",
    "Person ID",
    "Company Name",
    "Given Name",
    "Family Name",
    "Telephone Number",
    "Mobile Number",
    "Email",
    "Tele ID",
    "Tele Name",
    "Result Group",
    "Result Detail",
    "Final Status",
    "Is Terminal",
    "Contact Current Status",
  ] as const;

  const EDIT_HEADERS = [
    "Edited At",
    "Edited By ID",
    "Edited By Name",
    "Person ID",
    "Company Name",
    "Given Name",
    "Family Name",
    "Telephone Number",
    "Mobile Number",
    "Email",
    "Field",
    "Old Value",
    "New Value",
  ] as const;

  const exportExcel3Sheets = async () => {
    setExportingExcel(true);

    try {
      // 1) Contacts
      const contactsRaw = await fetchAllByRange<any>(async (from, to) => {
        const { data, error } = await supabase
          .from("v_contacts_export_enriched")
          .select("*")
          .eq("upload_id", vm.uploadId)
          .order("contact_id", { ascending: true })
          .range(from, to);

        if (error) throw error;
        return (data as any[]) ?? [];
      }, 1000);

      const contacts = normalizeByHeaders(contactsRaw, CONTACT_HEADERS);

      // 2) Call Logs
      // Yêu cầu view đã có call_log_id để pagination deterministic
      const logsRaw = await fetchAllByRange<any>(async (from, to) => {
        const { data, error } = await supabase
          .from("v_call_logs_export2")
          .select("*")
          .eq("upload_id", vm.uploadId)
          .order("call_log_id", { ascending: true })
          .range(from, to);

        if (error) throw error;
        return (data as any[]) ?? [];
      }, 1000);

      const logs = normalizeByHeaders(logsRaw, LOG_HEADERS);

      // 3) Edit History
      // Yêu cầu view đã có edit_id để pagination deterministic
      const editsRaw = await fetchAllByRange<any>(async (from, to) => {
        const { data, error } = await supabase
          .from("v_contact_edits_export2")
          .select("*")
          .eq("upload_id", vm.uploadId)
          .order("edit_id", { ascending: true })
          .range(from, to);

        if (error) throw error;
        return (data as any[]) ?? [];
      }, 1000);

      const edits = normalizeByHeaders(editsRaw, EDIT_HEADERS);

      const base = safeFileBaseName(
        `${u.campaign_name ?? "campaign"}_${new Date().toISOString().slice(0, 10)}`
      );
      const filename = `${base}_EXPORT.xlsx`;

      downloadWorkbookXlsx(filename, [
        { name: "Contacts", rows: contacts, headers: [...CONTACT_HEADERS] },
        { name: "Call Logs", rows: logs, headers: [...LOG_HEADERS] },
        { name: "Edit History", rows: edits, headers: [...EDIT_HEADERS] },
      ]);
    } catch (e: any) {
      alert(e?.message ?? "Export Excel failed");
      console.error("Export Excel failed:", e);
    } finally {
      setExportingExcel(false);
    }
  };

  const progressBarWidth = `${derived.progress}%`;

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="rounded-lg border p-3 text-sm bg-muted/20">
          <div className="font-medium">{derived.headline.text}</div>
          {derived.importMsg ? (
            <div className="mt-1 text-xs opacity-70">{derived.importMsg}</div>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border p-3">
            <div className="text-xs opacity-60">Contacts (DB / Declared)</div>
            <div className="text-2xl font-semibold tabular-nums">
              {fmt(derived.total)}
              <span className="text-sm opacity-60"> / {fmt(derived.declared)}</span>
            </div>
          </div>

          <div className="rounded-lg border p-3">
            <div className="text-xs opacity-60">Completed</div>
            <div className="text-2xl font-semibold tabular-nums">{fmt(derived.terminal)}</div>
            <div className="text-xs opacity-70">Completion rate {pct(derived.progress)}</div>
          </div>

          <div className="rounded-lg border p-3">
            <div className="text-xs opacity-60">Remaining</div>
            <div className="text-2xl font-semibold tabular-nums">{fmt(derived.inProgress)}</div>
            <div className="text-xs opacity-70">Locked {pct(derived.lockedRate)}</div>
          </div>

          <div className="rounded-lg border p-3">
            <div className="text-xs opacity-60">Available</div>
            <div className="text-2xl font-semibold tabular-nums">{fmt(derived.available)}</div>
            <div className="text-xs opacity-70">Availability {pct(derived.availableRate)}</div>
          </div>
        </div>

        <div className="h-2 w-full rounded-full bg-muted">
          <div
            className="h-2 rounded-full bg-foreground"
            style={{ width: progressBarWidth }}
          />
        </div>

        <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs opacity-70">
            Export 1 Excel file with 3 sheets (Contacts / Call Logs / Edit History).
          </div>

          <Button
            size="lg"
            onClick={exportExcel3Sheets}
            disabled={exportingExcel || vm.loading}
            className="gap-2"
          >
            {exportingExcel ? "Exporting..." : "Export Campaign Data"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}