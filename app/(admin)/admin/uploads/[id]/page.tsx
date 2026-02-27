"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { toCSV, downloadText } from "@/lib/crm/export";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { StatusButton } from "@/components/status-button";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

type CampaignStatus = "RUNNING" | "PAUSE" | "COMPLETED" | "DONE";
const CAMPAIGN_STATUSES: CampaignStatus[] = ["RUNNING", "PAUSE", "COMPLETED", "DONE"];

type Upload = {
  id: string;
  campaign_name: string;
  filename: string | null;
  total_rows: number;
  status: CampaignStatus;
  created_at: string;
};

type StatusCount = { current_status: string; count: number };

type Tele = { id: string; full_name: string | null };

type ContactRow = {
  id: string;
  upload_id: string;
  row_no: number | null;

  company_name: string | null;
  given_name: string | null;
  family_name: string | null;
  email: string | null;
  normalized_phone: string | null;

  current_status: string;
  call_attempts: number;
  last_called_at: string | null;

  last_result_group: string | null;
  last_result_detail: string | null;
  last_note_text: string | null;

  assigned_to: string | null;
  assigned_name: string | null;
  assigned_at: string | null;
  lease_expires_at: string | null;
};

const CONTACT_STATUS_OPTIONS = ["ALL", "NEW", "ASSIGNED", "CALLBACK", "INVALID", "DONE"] as const;
type ContactStatusFilter = (typeof CONTACT_STATUS_OPTIONS)[number];

type AssigneeFilter =
  | { type: "ALL" }
  | { type: "UNASSIGNED" }
  | { type: "TELE"; teleId: string };

function fmtDT(s: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function isLocked(lease_expires_at: string | null) {
  if (!lease_expires_at) return false;
  return new Date(lease_expires_at).getTime() > Date.now();
}

function assigneeFilterToValue(x: AssigneeFilter): string {
  if (x.type === "ALL") return "ALL";
  if (x.type === "UNASSIGNED") return "UNASSIGNED";
  return `TELE:${x.teleId}`;
}

function assigneeValueToFilter(v: string): AssigneeFilter {
  if (v === "ALL") return { type: "ALL" };
  if (v === "UNASSIGNED") return { type: "UNASSIGNED" };
  if (v.startsWith("TELE:")) return { type: "TELE", teleId: v.slice("TELE:".length) };
  return { type: "ALL" };
}

export default function UploadDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [upload, setUpload] = useState<Upload | null>(null);
  const [counts, setCounts] = useState<StatusCount[]>([]);
  const [loading, setLoading] = useState(false);

  // rename/delete dialogs
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // export
  const [exportingReport, setExportingReport] = useState(false);
  const [exportingLogs, setExportingLogs] = useState(false);

  // tele access
  const [teles, setTeles] = useState<Tele[]>([]);
  const [members, setMembers] = useState<Set<string>>(new Set());
  const [savingMember, setSavingMember] = useState<string | null>(null);

  // contacts console
  const [contactRows, setContactRows] = useState<ContactRow[]>([]);
  const [contactTotal, setContactTotal] = useState(0);

  const [q, setQ] = useState("");
  const [filterStatus, setFilterStatus] = useState<ContactStatusFilter>("ALL");
  const [filterAssignee, setFilterAssignee] = useState<AssigneeFilter>({ type: "ALL" });

  const [page, setPage] = useState(1);
  const pageSize = 50;

  // selection + bulk
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectedCount = selectedIds.size;

  // bulk assign dialog
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkAssignTeleId, setBulkAssignTeleId] = useState<string>("");

  // assign single dialog
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignContactId, setAssignContactId] = useState<string | null>(null);
  const [assignTeleId, setAssignTeleId] = useState<string>("");

  const memberTeles = useMemo(() => teles.filter((t) => members.has(t.id)), [teles, members]);

  const totalContactsInDb = useMemo(
    () => counts.reduce((sum, x) => sum + (x.count ?? 0), 0),
    [counts]
  );

  const getCount = (k: string) => counts.find((x) => x.current_status === k)?.count ?? 0;
  const doneCount = useMemo(() => getCount("DONE"), [counts]);
  const invalidCount = useMemo(() => getCount("INVALID"), [counts]);
  const callbackCount = useMemo(() => getCount("CALLBACK"), [counts]);
  const assignedCount = useMemo(() => getCount("ASSIGNED"), [counts]);
  const newCount = useMemo(() => getCount("NEW"), [counts]);

  const progressPct = useMemo(() => {
    const denom = totalContactsInDb || 0;
    if (!denom) return 0;
    const terminal = doneCount + invalidCount;
    return Math.max(0, Math.min(100, Math.round((terminal / denom) * 100)));
  }, [totalContactsInDb, doneCount, invalidCount]);

  const loadUpload = async () => {
    const { data: u, error } = await supabase
      .from("uploads")
      .select("id,campaign_name,filename,total_rows,status,created_at")
      .eq("id", id)
      .single();

    if (error) throw error;
    if (!u) throw new Error("Campaign not found");

    const status = String((u as any).status) as CampaignStatus;
    setUpload({
      id: (u as any).id,
      campaign_name: (u as any).campaign_name,
      filename: (u as any).filename ?? null,
      total_rows: Number((u as any).total_rows ?? 0),
      status,
      created_at: (u as any).created_at,
    });

    setRenameValue((u as any).campaign_name ?? "");
  };

  const loadCounts = async () => {
    const { data, error } = await supabase.rpc("rpc_contact_status_counts", { p_upload_id: id });
    if (error) throw error;

    const normalized: StatusCount[] = ((data as any[]) ?? []).map((x) => ({
      current_status: String(x.current_status).toUpperCase(),
      count: Number(x.count ?? 0),
    }));
    setCounts(normalized);
  };

  const loadTelesAndMembers = async () => {
    const { data: ps, error: psErr } = await supabase
      .from("profiles")
      .select("id,full_name,role")
      .eq("role", "TELE")
      .order("full_name", { ascending: true });

    if (psErr) throw psErr;
    setTeles((((ps as any[]) ?? []) as any[]).map((x) => ({ id: x.id, full_name: x.full_name ?? null })));

    const { data: ms, error: msErr } = await supabase
      .from("upload_members")
      .select("tele_id")
      .eq("upload_id", id);

    if (msErr) throw msErr;
    setMembers(new Set((((ms as any[]) ?? []) as any[]).map((x) => x.tele_id)));
  };

  const clearSelectionIfNotOnPage = (pageIds: string[]) => {
    // keep selection across pages (enterprise behavior) OR clear per page.
    // Here we keep across pages. Do nothing.
    // If you prefer per-page selection, uncomment:
    // setSelectedIds(new Set());
  };

  const loadContacts = async () => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("v_admin_campaign_contacts")
      .select(
        "id,upload_id,row_no,company_name,given_name,family_name,email,normalized_phone,current_status,call_attempts,last_called_at,last_result_group,last_result_detail,last_note_text,assigned_to,assigned_name,assigned_at,lease_expires_at",
        { count: "exact" }
      )
      .eq("upload_id", id)
      .order("row_no", { ascending: true, nullsFirst: false });

    if (filterStatus !== "ALL") query = query.eq("current_status", filterStatus);

    if (filterAssignee.type === "UNASSIGNED") query = query.is("assigned_to", null);
    else if (filterAssignee.type === "TELE") query = query.eq("assigned_to", filterAssignee.teleId);

    const s = q.trim();
    if (s) {
      const like = `%${s}%`;
      query = query.or(
        [
          `company_name.ilike.${like}`,
          `given_name.ilike.${like}`,
          `family_name.ilike.${like}`,
          `email.ilike.${like}`,
          `normalized_phone.ilike.${like}`,
        ].join(",")
      );
    }

    const { data, error, count } = await query.range(from, to);
    if (error) throw error;

    const rows = (((data as any) ?? []) as ContactRow[]);
    setContactRows(rows);
    setContactTotal(Number(count ?? 0));

    clearSelectionIfNotOnPage(rows.map((x) => x.id));
  };

  const refreshAll = async () => {
    if (!id) return;
    setLoading(true);
    try {
      await Promise.all([loadUpload(), loadCounts(), loadTelesAndMembers()]);
      await loadContacts();
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    (async () => {
      try {
        await loadContacts();
      } catch (e: any) {
        console.error(e);
        alert(e?.message ?? "Load contacts failed");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, q, filterStatus, filterAssignee.type, (filterAssignee as any).teleId]);

  const setCampaignStatus = async (next: CampaignStatus) => {
    if (!upload) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("uploads").update({ status: next }).eq("id", upload.id);
      if (error) throw error;
      await loadUpload();
    } catch (e: any) {
      alert(e?.message ?? "Update status failed");
    } finally {
      setLoading(false);
    }
  };

  const renameCampaign = async () => {
    if (!upload) return;
    const name = renameValue.trim();
    if (!name) return alert("Campaign name required");

    setLoading(true);
    try {
      const { error } = await supabase.from("uploads").update({ campaign_name: name }).eq("id", upload.id);
      if (error) throw error;
      setRenameOpen(false);
      await loadUpload();
    } catch (e: any) {
      alert(e?.message ?? "Rename failed");
    } finally {
      setLoading(false);
    }
  };

  const deleteCampaign = async () => {
    if (!upload) return;
    setDeleteBusy(true);
    try {
      const { error } = await supabase.from("uploads").delete().eq("id", upload.id);
      if (error) throw error;
      window.location.href = "/admin/uploads";
    } catch (e: any) {
      alert(e?.message ?? "Delete failed");
    } finally {
      setDeleteBusy(false);
    }
  };

  const toggleMember = async (teleId: string, checked: boolean) => {
    if (!upload) return;
    setSavingMember(teleId);
    try {
      if (checked) {
        const { data: sess } = await supabase.auth.getSession();
        const me = sess.session?.user.id ?? null;
        const { error } = await supabase.from("upload_members").insert({
          upload_id: upload.id,
          tele_id: teleId,
          added_by: me,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("upload_members")
          .delete()
          .eq("upload_id", upload.id)
          .eq("tele_id", teleId);
        if (error) throw error;
      }
      await loadTelesAndMembers();
    } catch (e: any) {
      alert(e?.message ?? "Update tele access failed");
    } finally {
      setSavingMember(null);
    }
  };

  const releaseContact = async (contactId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("contacts")
        .update({ assigned_to: null, assigned_at: null, lease_expires_at: null })
        .eq("id", contactId);

      if (error) throw error;
      await Promise.all([loadCounts(), loadContacts()]);
    } catch (e: any) {
      alert(e?.message ?? "Release failed");
    } finally {
      setLoading(false);
    }
  };

  const openAssign = (contactId: string) => {
    setAssignContactId(contactId);
    setAssignTeleId("");
    setAssignOpen(true);
  };

  const confirmAssign = async () => {
    if (!assignContactId) return;
    if (!assignTeleId) return alert("Choose a tele");

    setLoading(true);
    try {
      const { error } = await supabase
        .from("contacts")
        .update({
          assigned_to: assignTeleId,
          assigned_at: new Date().toISOString(),
          lease_expires_at: null,
        })
        .eq("id", assignContactId);

      if (error) throw error;

      setAssignOpen(false);
      await Promise.all([loadCounts(), loadContacts()]);
    } catch (e: any) {
      alert(e?.message ?? "Assign failed");
    } finally {
      setLoading(false);
    }
  };

  // ===== Bulk selection helpers =====
  const pageIds = useMemo(() => contactRows.map((x) => x.id), [contactRows]);

  const allSelectedOnPage = useMemo(() => {
    if (!pageIds.length) return false;
    return pageIds.every((id) => selectedIds.has(id));
  }, [pageIds, selectedIds]);

  const toggleSelectAllOnPage = (checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) pageIds.forEach((id) => next.add(id));
    else pageIds.forEach((id) => next.delete(id));
    setSelectedIds(next);
  };

  const toggleSelectOne = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    setSelectedIds(next);
  };

  const clearSelection = () => setSelectedIds(new Set());

  const bulkRelease = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Release ${selectedIds.size} contacts?`)) return;

    setLoading(true);
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase
        .from("contacts")
        .update({ assigned_to: null, assigned_at: null, lease_expires_at: null })
        .in("id", ids);

      if (error) throw error;

      clearSelection();
      await Promise.all([loadCounts(), loadContacts()]);
    } catch (e: any) {
      alert(e?.message ?? "Bulk release failed");
    } finally {
      setLoading(false);
    }
  };

  const openBulkAssign = () => {
    if (selectedIds.size === 0) return;
    setBulkAssignTeleId("");
    setBulkAssignOpen(true);
  };

  const confirmBulkAssign = async () => {
    if (selectedIds.size === 0) return;
    if (!bulkAssignTeleId) return alert("Choose a tele");

    setLoading(true);
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase
        .from("contacts")
        .update({
          assigned_to: bulkAssignTeleId,
          assigned_at: new Date().toISOString(),
          lease_expires_at: null,
        })
        .in("id", ids);

      if (error) throw error;

      setBulkAssignOpen(false);
      clearSelection();
      await Promise.all([loadCounts(), loadContacts()]);
    } catch (e: any) {
      alert(e?.message ?? "Bulk assign failed");
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async () => {
    setExportingReport(true);
    try {
      const { data, error } = await supabase.from("v_contacts_report").select("*").eq("upload_id", id);
      if (error) throw error;
      const csv = toCSV((data as any[]) ?? []);
      const filename = `${upload?.campaign_name ?? "report"}_${id}.csv`.replace(/[^\w\-]+/g, "_");
      downloadText(filename, csv);
    } catch (e: any) {
      alert(e?.message ?? "Export failed");
    } finally {
      setExportingReport(false);
    }
  };

  const exportLogs = async () => {
    setExportingLogs(true);
    try {
      const { data, error } = await supabase
        .from("v_call_logs_export")
        .select("*")
        .eq("upload_id", id)
        .order("called_at", { ascending: true });

      if (error) throw error;
      const csv = toCSV((data as any[]) ?? []);
      const filename = `${upload?.campaign_name ?? "call_logs"}_${id}.csv`.replace(/[^\w\-]+/g, "_");
      downloadText(filename, csv);
    } catch (e: any) {
      alert(e?.message ?? "Export failed");
    } finally {
      setExportingLogs(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(contactTotal / pageSize));

  if (!upload) return null;

  const assigneeSelectValue = assigneeFilterToValue(filterAssignee);

  return (
    <div className="space-y-4">
      {/* Campaign Console Header */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg">{upload.campaign_name}</CardTitle>
              <div className="text-sm opacity-70">
                {upload.filename ?? "—"} • Created {fmtDT(upload.created_at)}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={upload.status} kind="campaign" />
              <Button variant="outline" onClick={refreshAll} disabled={loading || exportingReport || exportingLogs}>
                {loading ? "Refreshing..." : "Refresh"}
              </Button>
              <Button variant="outline" onClick={() => setRenameOpen(true)} disabled={loading}>
                Rename
              </Button>
              <Button variant="destructive" onClick={() => setDeleteOpen(true)} disabled={loading}>
                Delete
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Campaign Status CRUD */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Campaign Status</div>
            <div className="flex flex-wrap gap-2">
              {CAMPAIGN_STATUSES.map((s) => (
                <StatusButton
                  key={s}
                  kind="campaign"
                  status={s}
                  active={upload.status === s}
                  disabled={loading}
                  onClick={() => setCampaignStatus(s)}
                />
              ))}
            </div>
          </div>

          {/* KPIs */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border p-3">
              <div className="text-xs opacity-60">Declared Rows</div>
              <div className="text-2xl font-semibold tabular-nums">{upload.total_rows}</div>
            </div>

            <div className="rounded-lg border p-3">
              <div className="text-xs opacity-60">Contacts in DB</div>
              <div className="text-2xl font-semibold tabular-nums">{totalContactsInDb}</div>
            </div>

            <div className="rounded-lg border p-3">
              <div className="text-xs opacity-60">Terminal (DONE + INVALID)</div>
              <div className="text-2xl font-semibold tabular-nums">{doneCount + invalidCount}</div>
            </div>

            <div className="rounded-lg border p-3">
              <div className="text-xs opacity-60">Progress</div>
              <div className="text-2xl font-semibold tabular-nums">{progressPct}%</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="opacity-70">Completion</div>
              <div className="tabular-nums opacity-70">
                DONE {doneCount} • INVALID {invalidCount} • CALLBACK {callbackCount} • ASSIGNED {assignedCount} • NEW {newCount}
              </div>
            </div>
            <div className="h-2 w-full rounded-full bg-muted">
              <div className="h-2 rounded-full bg-foreground" style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          {/* Export */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={exportReport} disabled={exportingReport || exportingLogs || loading}>
              {exportingReport ? "Exporting..." : "Export Report"}
            </Button>
            <Button variant="outline" onClick={exportLogs} disabled={exportingLogs || exportingReport || loading}>
              {exportingLogs ? "Exporting..." : "Export Call Logs"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tele Access */}
      <Card>
        <CardHeader>
          <CardTitle>Tele Access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm opacity-70">Select which tele agents can work on this campaign.</div>

          {teles.length === 0 ? (
            <div className="text-sm opacity-70">No TELE users found.</div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {teles.map((t) => {
                const checked = members.has(t.id);
                const busy = savingMember === t.id;

                return (
                  <label key={t.id} className="flex items-center gap-2 rounded-md border p-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={checked}
                      disabled={busy || loading}
                      onChange={(e) => toggleMember(t.id, e.target.checked)}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{t.full_name ?? t.id.slice(0, 8)}</div>
                      <div className="text-xs opacity-60 truncate">{busy ? "Saving..." : t.id}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contacts Console */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle>Contacts</CardTitle>
              <div className="text-sm opacity-70">
                Full campaign data • status • assignment • locks • last activity
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                placeholder="Search name/company/email/phone..."
                value={q}
                onChange={(e) => {
                  setPage(1);
                  setQ(e.target.value);
                }}
                className="sm:w-80"
              />

              <Select
                value={filterStatus}
                onValueChange={(v) => {
                  setPage(1);
                  setFilterStatus(v as ContactStatusFilter);
                }}
              >
                <SelectTrigger className="sm:w-44">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={assigneeSelectValue}
                onValueChange={(v) => {
                  setPage(1);
                  setFilterAssignee(assigneeValueToFilter(v));
                }}
              >
                <SelectTrigger className="sm:w-56">
                  <SelectValue placeholder="Assignee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">ALL</SelectItem>
                  <SelectItem value="UNASSIGNED">UNASSIGNED</SelectItem>
                  {memberTeles.map((t) => (
                    <SelectItem key={t.id} value={`TELE:${t.id}`}>
                      {t.full_name ?? t.id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Bulk action bar */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 p-2">
            <div className="text-sm">
              Selected: <span className="font-medium tabular-nums">{selectedCount}</span>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={selectedCount === 0 || loading}
                onClick={openBulkAssign}
              >
                Bulk Assign
              </Button>

              <Button
                variant="outline"
                disabled={selectedCount === 0 || loading}
                onClick={bulkRelease}
              >
                Bulk Release
              </Button>

              <Button
                variant="outline"
                disabled={selectedCount === 0 || loading}
                onClick={clearSelection}
              >
                Clear
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="flex items-center justify-between text-sm mb-3">
            <div className="opacity-70">
              Total: <span className="font-medium tabular-nums">{contactTotal}</span> • Page{" "}
              <span className="font-medium tabular-nums">{page}</span> /{" "}
              <span className="font-medium tabular-nums">{totalPages}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Prev
              </Button>
              <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                Next
              </Button>
            </div>
          </div>

          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[44px]">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={allSelectedOnPage}
                      onChange={(e) => toggleSelectAllOnPage(e.target.checked)}
                    />
                  </TableHead>
                  <TableHead className="min-w-[90px]">Row</TableHead>
                  <TableHead className="min-w-[260px]">Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Work</TableHead>
                  <TableHead className="min-w-[160px]">Last Call</TableHead>
                  <TableHead className="min-w-[220px]">Last Result</TableHead>
                  <TableHead className="min-w-[260px]">Last Note</TableHead>
                  <TableHead className="text-right min-w-[200px]">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {contactRows.map((c) => {
                  const locked = isLocked(c.lease_expires_at);
                  const checked = selectedIds.has(c.id);

                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={checked}
                          onChange={(e) => toggleSelectOne(c.id, e.target.checked)}
                        />
                      </TableCell>

                      <TableCell className="tabular-nums">
                        {c.row_no ?? "—"}
                        <div className="text-xs opacity-60 truncate">{c.id.slice(0, 8)}</div>
                      </TableCell>

                      <TableCell>
                        <div className="font-medium">
                          {(c.given_name || c.family_name)
                            ? `${c.given_name ?? ""} ${c.family_name ?? ""}`.trim()
                            : c.company_name ?? "—"}
                        </div>
                        <div className="text-xs opacity-60 truncate">
                          {c.company_name ?? "—"} • {c.email ?? "—"} • {c.normalized_phone ?? "—"}
                        </div>
                      </TableCell>

                      <TableCell>
                        <StatusBadge status={c.current_status} kind="contact" />
                        <div className="text-xs opacity-60 mt-1">
                          attempts: <span className="tabular-nums">{c.call_attempts ?? 0}</span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="font-medium truncate">
                          {c.assigned_name ?? (c.assigned_to ? c.assigned_to.slice(0, 8) : "—")}
                        </div>
                        <div className="text-xs opacity-60 truncate">assigned: {fmtDT(c.assigned_at)}</div>
                      </TableCell>

                      <TableCell>
                        {c.assigned_to ? (
                          locked ? (
                            <div className="text-sm font-medium">LOCKED</div>
                          ) : (
                            <div className="text-sm font-medium">ASSIGNED</div>
                          )
                        ) : (
                          <div className="text-sm font-medium">UNASSIGNED</div>
                        )}
                        <div className="text-xs opacity-60 truncate">lease: {fmtDT(c.lease_expires_at)}</div>
                      </TableCell>

                      <TableCell>{fmtDT(c.last_called_at)}</TableCell>

                      <TableCell>
                        <div className="text-sm font-medium truncate">{c.last_result_group ?? "—"}</div>
                        <div className="text-xs opacity-60 truncate">{c.last_result_detail ?? "—"}</div>
                      </TableCell>

                      <TableCell className="max-w-[280px]">
                        <div className="text-sm truncate">{c.last_note_text ?? "—"}</div>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => openAssign(c.id)} disabled={loading}>
                            Assign
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => releaseContact(c.id)}
                            disabled={loading || !c.assigned_to}
                          >
                            Release
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {contactRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="py-10 text-center text-sm opacity-70">
                      No contacts match the current filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Rename dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Campaign</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <div className="text-sm opacity-70">New campaign name</div>
            <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={renameCampaign} disabled={loading}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Campaign</DialogTitle>
          </DialogHeader>

          <div className="text-sm opacity-70">
            This will delete the campaign and related contacts/memberships (if cascades are set). Cannot be undone.
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleteBusy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteCampaign} disabled={deleteBusy}>
              {deleteBusy ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single Assign dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Contact</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <div className="text-sm opacity-70">Pick a tele agent (only agents with campaign access)</div>

            <Select value={assignTeleId} onValueChange={setAssignTeleId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose tele" />
              </SelectTrigger>
              <SelectContent>
                {memberTeles.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.full_name ?? t.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={confirmAssign} disabled={loading}>
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Assign dialog */}
      <Dialog open={bulkAssignOpen} onOpenChange={setBulkAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Assign</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <div className="text-sm opacity-70">
              Assign <b>{selectedCount}</b> contacts to:
            </div>

            <Select value={bulkAssignTeleId} onValueChange={setBulkAssignTeleId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose tele" />
              </SelectTrigger>
              <SelectContent>
                {memberTeles.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.full_name ?? t.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkAssignOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={confirmBulkAssign} disabled={loading || selectedCount === 0}>
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}