"use client";

import { useCallback, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type {
  Upload,
  Tele,
  ContactRow,
  CampaignKpis,
  CampaignStatus,
  ContactStatusFilter,
  AssigneeFilter,
  SortKey,
} from "../lib/types";
import { clamp, normalizeCampaignStatus } from "../lib/utils";

function emptyKpis(): CampaignKpis {
  return { total: 0, terminal: 0, in_progress: 0, locked: 0, expired_assigned: 0, unassigned: 0, available: 0 };
}

/** Fallback KPI compute: only select minimal fields (status/assigned/lease) */
async function aggregateKpisFallback(uploadId: string): Promise<CampaignKpis> {
  const pageSize = 1000;
  let from = 0;

  let total = 0;
  let terminal = 0;
  let locked = 0;
  let expired_assigned = 0;
  let unassigned = 0;

  const now = Date.now();

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("contacts")
      .select("current_status,assigned_to,lease_expires_at")
      .eq("upload_id", uploadId)
      .range(from, to);

    if (error) throw error;

    const rows = (data as any[]) ?? [];
    for (const r of rows) {
      total += 1;

      const st = String(r.current_status ?? "NEW").toUpperCase();
      if (st === "DONE" || st === "INVALID") {
        terminal += 1;
        continue;
      }

      const asg = r.assigned_to ? String(r.assigned_to) : null;
      const leaseMs = r.lease_expires_at ? new Date(String(r.lease_expires_at)).getTime() : null;

      if (!asg) {
        unassigned += 1;
      } else {
        if (leaseMs && leaseMs > now) locked += 1;
        else expired_assigned += 1;
      }
    }

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  const in_progress = total - terminal;
  const available = in_progress - locked;
  return { total, terminal, in_progress, locked, expired_assigned, unassigned, available };
}

export function useUploadDetail(uploadId: string) {
  const [upload, setUpload] = useState<Upload | null>(null);
  const [kpis, setKpis] = useState<CampaignKpis>(emptyKpis());
  const [loading, setLoading] = useState(false);

  // dialogs (header)
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [descOpen, setDescOpen] = useState(false);
  const [descValue, setDescValue] = useState("");

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

  const [sortKey, setSortKey] = useState<SortKey>("row_no");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const memberTeles = useMemo(() => teles.filter((t) => members.has(t.id)), [teles, members]);

  const progressPct = useMemo(() => {
    const denom = kpis.total || 0;
    if (!denom) return 0;
    return clamp(Math.round((kpis.terminal / denom) * 100), 0, 100);
  }, [kpis]);

  const tryCleanupExpiredLeases = useCallback(async () => {
    try {
      const { error } = await supabase.rpc("rpc_cleanup_expired_leases", { p_upload_id: uploadId });
      if (error) console.warn("rpc_cleanup_expired_leases:", error.message);
    } catch {}
  }, [uploadId]);

  const loadUpload = useCallback(async () => {
    const { data: u, error } = await supabase
      .from("uploads")
      .select("id,campaign_name,description,filename,total_rows,status,created_at")
      .eq("id", uploadId)
      .single();

    if (error) throw error;
    if (!u) throw new Error("Campaign not found");

    setUpload({
      id: (u as any).id,
      campaign_name: (u as any).campaign_name,
      description: (u as any).description ?? null,
      filename: (u as any).filename ?? null,
      total_rows: Number((u as any).total_rows ?? 0),
      status: normalizeCampaignStatus((u as any).status),
      created_at: (u as any).created_at,
    });

    setRenameValue((u as any).campaign_name ?? "");
    setDescValue((u as any).description ?? "");
  }, [uploadId]);

  const loadKpis = useCallback(async () => {
    await tryCleanupExpiredLeases();

    try {
      const { data, error } = await supabase.rpc("rpc_campaign_kpis", { p_upload_id: uploadId });
      if (!error && data) {
        const row = Array.isArray(data) ? (data[0] ?? null) : data;
        if (row && typeof row === "object") {
          setKpis({
            total: Number((row as any).total ?? 0),
            terminal: Number((row as any).terminal ?? 0),
            in_progress: Number((row as any).in_progress ?? 0),
            locked: Number((row as any).locked ?? 0),
            expired_assigned: Number((row as any).expired_assigned ?? 0),
            unassigned: Number((row as any).unassigned ?? 0),
            available: Number((row as any).available ?? 0),
          });
          return;
        }
      }
    } catch {}

    const hard = await aggregateKpisFallback(uploadId);
    setKpis(hard);
  }, [uploadId, tryCleanupExpiredLeases]);

  const loadTelesAndMembers = useCallback(async () => {
    const { data: ps, error: psErr } = await supabase
      .from("profiles")
      .select("id,full_name,role")
      .eq("role", "TELE")
      .order("full_name", { ascending: true });

    if (psErr) throw psErr;
    setTeles((((ps as any[]) ?? []) as any[]).map((x) => ({ id: x.id, full_name: x.full_name ?? null })));

    const { data: ms, error: msErr } = await supabase.from("upload_members").select("tele_id").eq("upload_id", uploadId);

    if (msErr) throw msErr;
    setMembers(new Set((((ms as any[]) ?? []) as any[]).map((x) => x.tele_id)));
  }, [uploadId]);

  const loadContacts = useCallback(async () => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("v_admin_campaign_contacts")
      .select(
        "id,upload_id,row_no,company_name,given_name,family_name,email,normalized_phone,current_status,call_attempts,last_called_at,last_result_group,last_result_detail,last_note_text,assigned_to,assigned_name,assigned_at,lease_expires_at,last_action_by,last_action_name,last_action_at",
        { count: "exact" }
        )
      .eq("upload_id", uploadId);

    query = query.order(sortKey, { ascending: sortDir === "asc", nullsFirst: false });

    if (filterStatus !== "ALL") query = query.eq("current_status", filterStatus);

    if (filterAssignee.type === "UNASSIGNED") {
      query = query.or(`assigned_to.is.null,lease_expires_at.is.null,lease_expires_at.lte.${new Date().toISOString()}`);
    } else if (filterAssignee.type === "TELE") {
      query = query.eq("assigned_to", filterAssignee.teleId);
    }

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

    setContactRows(((data as any) ?? []) as ContactRow[]);
    setContactTotal(Number(count ?? 0));
  }, [uploadId, page, q, filterStatus, filterAssignee, sortKey, sortDir]);

  const refreshAll = useCallback(async () => {
    if (!uploadId) return;
    setLoading(true);
    try {
      await tryCleanupExpiredLeases();
      await Promise.all([loadUpload(), loadKpis(), loadTelesAndMembers(), loadContacts()]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [uploadId, tryCleanupExpiredLeases, loadUpload, loadKpis, loadTelesAndMembers, loadContacts]);

  // ===== mutations (header) =====
  const setCampaignStatus = useCallback(
    async (next: CampaignStatus) => {
      if (!upload) return;
      setLoading(true);
      try {
        const { error } = await supabase.from("uploads").update({ status: next }).eq("id", upload.id);
        if (error) throw error;
        await loadUpload();
      } finally {
        setLoading(false);
      }
    },
    [upload, loadUpload]
  );

  const renameCampaign = useCallback(async () => {
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
  }, [upload, renameValue, loadUpload]);

  const saveDescription = useCallback(async () => {
    if (!upload) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("uploads")
        .update({ description: descValue.trim() || null })
        .eq("id", upload.id);
      if (error) throw error;
      setDescOpen(false);
      await loadUpload();
    } catch (e: any) {
      alert(e?.message ?? "Save description failed");
    } finally {
      setLoading(false);
    }
  }, [upload, descValue, loadUpload]);

  const deleteCampaign = useCallback(async () => {
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
  }, [upload]);

  const toggleMember = useCallback(
    async (teleId: string, checked: boolean) => {
      if (!upload) return;
      setSavingMember(teleId);
      try {
        if (checked) {
          const { data: sess } = await supabase.auth.getSession();
          const me = sess.session?.user.id ?? null;
          const { error } = await supabase
            .from("upload_members")
            .insert({ upload_id: upload.id, tele_id: teleId, added_by: me });
          if (error) throw error;
        } else {
          const { error } = await supabase.from("upload_members").delete().eq("upload_id", upload.id).eq("tele_id", teleId);
          if (error) throw error;
        }
        await loadTelesAndMembers();
      } catch (e: any) {
        alert(e?.message ?? "Update tele access failed");
      } finally {
        setSavingMember(null);
      }
    },
    [upload, loadTelesAndMembers]
  );

  // small helpers for UI sorting
  const clickSort = useCallback(
    (k: SortKey) => {
      if (sortKey !== k) {
        setSortKey(k);
        setSortDir("asc");
        setPage(1);
        return;
      }
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      setPage(1);
    },
    [sortKey]
  );

  const sortIcon = useCallback(
    (k: SortKey) => {
      if (sortKey !== k) return "↕";
      return sortDir === "asc" ? "↑" : "↓";
    },
    [sortKey, sortDir]
  );

  return {
    uploadId,

    // main state
    upload,
    kpis,
    loading,

    // header dialogs state
    renameOpen,
    renameValue,
    deleteOpen,
    deleteBusy,
    descOpen,
    descValue,
    exportingReport,
    exportingLogs,

    // tele
    teles,
    members,
    memberTeles,
    savingMember,

    // contacts
    contactRows,
    contactTotal,
    q,
    filterStatus,
    filterAssignee,
    page,
    pageSize,
    sortKey,
    sortDir,

    // computed
    progressPct,

    // setters
    setRenameOpen,
    setRenameValue,
    setDeleteOpen,
    setDescOpen,
    setDescValue,
    setExportingReport,
    setExportingLogs,

    setQ,
    setFilterStatus,
    setFilterAssignee,
    setPage,

    // actions
    refreshAll,
    loadContacts,
    loadKpis,
    loadUpload,
    loadTelesAndMembers,
    tryCleanupExpiredLeases,

    setCampaignStatus,
    renameCampaign,
    saveDescription,
    deleteCampaign,
    toggleMember,

    clickSort,
    sortIcon,
  };
}

export type UploadDetailVM = ReturnType<typeof useUploadDetail>;