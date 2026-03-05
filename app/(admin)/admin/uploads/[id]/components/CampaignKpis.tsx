"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { UploadDetailVM } from "../hooks/useUploadDetail";
import {
  toCSV,
  downloadText,
  fetchAllByRange,
  downloadWorkbookXlsx,
} from "@/lib/crm/export";
import { supabase } from "@/lib/supabase/client";
import { clamp } from "../lib/utils";

function fmt(n: number) {
  return Number.isFinite(n) ? n.toLocaleString() : "0";
}

function pct(n: number) {
  return `${clamp(Math.round(n), 0, 100)}%`;
}

export default function CampaignKpis({ vm }: { vm: UploadDetailVM }) {
  const u = vm.upload!;
  const k = vm.kpis;

  const [exportingExcel, setExportingExcel] = useState(false);

  /*
  ==========================
  KPI DERIVED VALUES
  ==========================
  */

  const derived = useMemo(() => {
    const declared = Number(u.total_rows ?? 0);
    const total = Number(k.total ?? 0);
    const terminal = Number(k.terminal ?? 0);

    const inProgress = Number(k.in_progress ?? Math.max(total - terminal, 0));

    const locked = Number(k.locked ?? 0);
    const expired = Number(k.expired_assigned ?? 0);
    const unassigned = Number(k.unassigned ?? 0);

    const available = Number(k.available ?? Math.max(inProgress - locked, 0));

    const progress = total
      ? clamp(Math.round((terminal / total) * 100), 0, 100)
      : 0;

    const lockedRate = inProgress
      ? clamp(Math.round((locked / inProgress) * 100), 0, 100)
      : 0;

    const availableRate = inProgress
      ? clamp(Math.round((available / inProgress) * 100), 0, 100)
      : 0;

    const importOk = declared === 0 ? true : declared === total;

    const importDelta = declared - total;

    const canComplete = total > 0 && terminal === total;
    const isBlocked = inProgress > 0 && available === 0 && locked > 0;
    const hasWork = inProgress > 0;

    const headline = (() => {
      if (canComplete)
        return {
          tone: "ok" as const,
          text: "✅ All contacts are terminal. You can mark campaign as COMPLETED/DONE.",
        };

      if (isBlocked)
        return {
          tone: "warn" as const,
          text: "⚠ Queue blocked: all remaining contacts are LOCKED (0 available).",
        };

      if (hasWork && available > 0)
        return {
          tone: "ok" as const,
          text: `✅ ${fmt(available)} contacts available to call now.`,
        };

      if (total === 0)
        return { tone: "muted" as const, text: "No contacts loaded yet." };

      return { tone: "muted" as const, text: "Campaign is running." };
    })();

    const importMsg = (() => {
      if (importOk) return null;
      if (declared === 0) return null;

      if (importDelta > 0)
        return `⚠ Imported fewer than declared: missing ${fmt(
          importDelta
        )} rows.`;

      return `⚠ Imported more than declared: extra ${fmt(
        Math.abs(importDelta)
      )} rows.`;
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

  /*
  ==========================
  EXPORT HEADERS
  ==========================
  */

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

  /*
  ==========================
  EXPORT CONTACTS CSV
  ==========================
  */

  const exportReport = async () => {
    vm.setExportingReport(true);

    try {
      const rows = await fetchAllByRange<any>(async (from, to) => {
        const { data, error } = await supabase
          .from("v_contacts_export_enriched")
          .select("*")
          .eq("upload_id", vm.uploadId)
          .range(from, to);

        if (error) throw error;

        return (data as any[]) ?? [];
      });

      const normalized = rows.map((r) => {
        const out: Record<string, any> = {};

        for (const h of CONTACT_HEADERS) {
          out[h] = r[h] ?? "";
        }

        return out;
      });

      const csv = toCSV(normalized, [...CONTACT_HEADERS]);

      function safeFileBaseName(name: string) {
        return String(name ?? "")
          .trim()
          .replace(/\s+/g, "_")
          .replace(/[^\w\-]+/g, "_")
          .replace(/^_+|_+$/g, "")
          .slice(0, 120);
      }

      const base = safeFileBaseName(
        `${u.campaign_name ?? "campaign"}_${new Date().toISOString().slice(0,10)}`
      );

      const filename = `${base}_campaign_export.xlsx`;
      
      downloadText(filename, csv);
    } catch (e: any) {
      alert(e?.message ?? "Export failed");
    } finally {
      vm.setExportingReport(false);
    }
  };

  /*
  ==========================
  EXPORT CALL LOGS CSV
  ==========================
  */

  const exportLogs = async () => {
    vm.setExportingLogs(true);

    try {
      const rows = await fetchAllByRange<any>(async (from, to) => {
        const { data, error } = await supabase
          .from("v_call_logs_export2")
          .select("*")
          .eq("upload_id", vm.uploadId)
          .range(from, to);

        if (error) throw error;

        return (data as any[]) ?? [];
      });

      const normalized = rows.map((r) => {
        const out: Record<string, any> = {};

        for (const h of LOG_HEADERS) {
          out[h] = r[h] ?? "";
        }

        return out;
      });

      const csv = toCSV(normalized, [...LOG_HEADERS]);

      const filename = `${u.campaign_name ?? "call_logs"}_${
        vm.uploadId
      }_call_logs.csv`.replace(/[^\w\-]+/g, "_");

      downloadText(filename, csv);
    } catch (e: any) {
      alert(e?.message ?? "Export failed");
    } finally {
      vm.setExportingLogs(false);
    }
  };

  /*
  ==========================
  ENTERPRISE EXPORT (XLSX)
  ==========================
  */

  const exportExcel3Sheets = async () => {
    setExportingExcel(true);

    try {
      /*
      CONTACTS
      */

      const contacts = await fetchAllByRange<any>(async (from, to) => {
        const { data, error } = await supabase
          .from("v_contacts_master_enriched")
          .select("*")
          .eq("upload_id", vm.uploadId)
          .range(from, to);

        if (error) throw error;

        return (data as any[]) ?? [];
      });

      const contactRows = contacts.map((r) => ({
        "Person ID": r["Person ID"] ?? "",
        "Company Info": r["Company Info"] ?? "",
        "Company Name": r["Company Name"] ?? "",
        "Given Name": r["Given Name"] ?? "",
        "Family Name": r["Family Name"] ?? "",
        "Job Title": r["Job Title"] ?? "",
        Department: r["Department"] ?? "",
        Country: r["Country"] ?? "",
        Email: r["Email"] ?? "",
        "Email (Second)": r["Email (Second)"] ?? "",
        "Telephone Number": r["Telephone Number"] ?? "",
        "Mobile Number": r["Mobile Number"] ?? "",
        "Address-Line1": r["Address-Line1"] ?? "",
        City: r["City"] ?? "",
        State: r["State"] ?? "",
        "Registered Event": r["Registered Event"] ?? "",
        "Visited Event": r["Visited Event"] ?? "",

        "Current Status": r.current_status ?? "",
        "Assigned Tele ID": r.assigned_to ?? "",
        "Assigned Tele Name": r.assigned_tele_name ?? "",
        "Assigned At": r.assigned_at ?? "",
        "Lease Expires At": r.lease_expires_at ?? "",
        "Call Attempts": r.call_attempts ?? "",
        "Last Action At": r.last_action_at ?? "",
        "Updated At": r.updated_at ?? "",

        "Total Calls": r.total_calls ?? "",
        "First Call At": r.first_call_at ?? "",
        "Last Call At": r.last_call_at ?? "",
        "Last Called At": r.last_called_at ?? "",
        "Next Call At": r.next_call_at ?? "",
        "Last Note": r.last_note_text ?? "",
        "Last Result Group": r.last_result_group ?? "",
        "Last Result Detail": r.last_result_detail ?? "",
        "Last Result Final Status": r.last_result_final_status ?? "",
        "Last Result Is Terminal": r.last_result_is_terminal ?? "",
        "Last Caller ID": r.last_tele_id ?? "",
        "Last Caller Name": r.last_tele_name ?? "",

        "Edited Fields Count": r.edited_fields_count ?? "",
        "Last Edited At": r.last_edited_at ?? "",
        "Last Edited By ID": r.last_edited_by ?? "",
        "Last Edited By Name": r.last_edited_by_name ?? "",
        "Edited Fields List": r.edited_fields_list ?? "",
      }));

      /*
      CALL LOGS
      */

      const logs = await fetchAllByRange<any>(async (from, to) => {
        const { data, error } = await supabase
          .from("v_call_logs_export2")
          .select("*")
          .eq("upload_id", vm.uploadId)
          .range(from, to);

        if (error) throw error;

        return (data as any[]) ?? [];
      });

      /*
      EDIT HISTORY
      */

      const edits = await fetchAllByRange<any>(async (from, to) => {
        const { data, error } = await supabase
          .from("v_contact_edits_export2")
          .select("*")
          .eq("upload_id", vm.uploadId)
          .range(from, to);

        if (error) throw error;

        return (data as any[]) ?? [];
      });

      const filename = `${u.campaign_name ?? "campaign"}_${
        vm.uploadId
      }_EXPORT.xlsx`.replace(/[^\w\-]+/g, "_");

      downloadWorkbookXlsx(filename, [
        {
          name: "Contacts Master",
          rows: contactRows,
          headers: [...CONTACT_HEADERS],
        },
        {
          name: "Call Logs",
          rows: logs,
          headers: [...LOG_HEADERS],
        },
        {
          name: "Edit History",
          rows: edits,
          headers: [...EDIT_HEADERS],
        },
      ]);
    } catch (e: any) {
      alert(e?.message ?? "Export Excel failed");
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
          {derived.importMsg && (
            <div className="mt-1 text-xs opacity-70">{derived.importMsg}</div>
          )}
        </div>

        {/* KPI cards */}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border p-3">
            <div className="text-xs opacity-60">Contacts (DB / Declared)</div>
            <div className="text-2xl font-semibold tabular-nums">
              {fmt(derived.total)}
              <span className="text-sm opacity-60">
                {" "}
                / {fmt(derived.declared)}
              </span>
            </div>
          </div>

          <div className="rounded-lg border p-3">
            <div className="text-xs opacity-60">Completed</div>
            <div className="text-2xl font-semibold tabular-nums">
              {fmt(derived.terminal)}
            </div>
            <div className="text-xs opacity-70">
              Completion rate {pct(derived.progress)}
            </div>
          </div>

          <div className="rounded-lg border p-3">
            <div className="text-xs opacity-60">Remaining</div>
            <div className="text-2xl font-semibold tabular-nums">
              {fmt(derived.inProgress)}
            </div>
          </div>

          <div className="rounded-lg border p-3">
            <div className="text-xs opacity-60">Available</div>
            <div className="text-2xl font-semibold tabular-nums">
              {fmt(derived.available)}
            </div>
          </div>
        </div>

        <div className="h-2 w-full rounded-full bg-muted">
          <div
            className="h-2 rounded-full bg-foreground"
            style={{ width: progressBarWidth }}
          />
        </div>

        <div className="flex items-center justify-between border-t pt-4">
          <div className="text-xs opacity-70">
            Export full campaign dataset including contacts, call logs and edit history.
          </div>

          <Button
            size="lg"
            variant="default"
            onClick={exportExcel3Sheets}
            disabled={exportingExcel || vm.loading}
            className="gap-2"
          >
            {exportingExcel ? (
              <>Exporting...</>
            ) : (
              <>
                Export Campaign Data
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}