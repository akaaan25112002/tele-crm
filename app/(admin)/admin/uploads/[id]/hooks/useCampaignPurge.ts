"use client";

import { useCallback, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type {
  DeleteBatchResult,
  ImportBatchRow,
  PurgeMode,
  PurgePreview,
  PurgeResult,
} from "../lib/import-batch.types";

export function useCampaignPurge(uploadId: string) {
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [deleteBatchOpen, setDeleteBatchOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [preview, setPreview] = useState<PurgePreview | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [purgeMode, setPurgeMode] = useState<PurgeMode>("UNTOUCHED_ONLY");
  const [confirmText, setConfirmText] = useState("");
  const [lastPurgeResult, setLastPurgeResult] = useState<PurgeResult | null>(null);

  const [targetBatch, setTargetBatch] = useState<ImportBatchRow | null>(null);
  const [forceDeleteBatch, setForceDeleteBatch] = useState(false);
  const [lastDeleteBatchResult, setLastDeleteBatchResult] = useState<DeleteBatchResult | null>(null);

  const loadPreview = useCallback(async () => {
    if (!uploadId) return;

    setPreviewError("");
    setPreview(null);

    try {
      const { data, error } = await supabase.rpc("rpc_campaign_purge_preview", {
        p_upload_id: uploadId,
      });

      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error("No purge preview data");

      setPreview({
        upload_id: String(row.upload_id ?? uploadId),
        total_contacts: Number(row.total_contacts ?? 0),
        untouched_contacts: Number(row.untouched_contacts ?? 0),
        touched_contacts: Number(row.touched_contacts ?? 0),
        contacts_with_logs: Number(row.contacts_with_logs ?? 0),
        contacts_with_edits: Number(row.contacts_with_edits ?? 0),
        active_leases: Number(row.active_leases ?? 0),
        safe_untouched_deletable: Number(row.safe_untouched_deletable ?? 0),
      });
    } catch (e: any) {
      console.error(e);
      setPreviewError(e?.message ?? "Load purge preview failed");
      setPreview(null);
    }
  }, [uploadId]);

  const openPurge = useCallback(async () => {
    setPurgeMode("UNTOUCHED_ONLY");
    setConfirmText("");
    setLastPurgeResult(null);
    setPurgeOpen(true);
    await loadPreview();
  }, [loadPreview]);

  const purgeNow = useCallback(async () => {
    if (!uploadId) throw new Error("Missing uploadId");
    if (confirmText.trim() !== "DELETE") {
      throw new Error('Please type "DELETE" to confirm purge');
    }

    setBusy(true);
    setLastPurgeResult(null);

    try {
      const { data, error } = await supabase.rpc("rpc_purge_campaign_data", {
        p_upload_id: uploadId,
        p_mode: purgeMode,
      });

      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      const parsed: PurgeResult = {
        upload_id: String(row?.upload_id ?? uploadId),
        deleted_contacts: Number(row?.deleted_contacts ?? 0),
        deleted_call_logs: Number(row?.deleted_call_logs ?? 0),
        deleted_contact_edits: Number(row?.deleted_contact_edits ?? 0),
        deleted_import_issues: Number(row?.deleted_import_issues ?? 0),
      };

      setLastPurgeResult(parsed);
      await loadPreview();
      return parsed;
    } finally {
      setBusy(false);
    }
  }, [uploadId, purgeMode, confirmText, loadPreview]);

  const openDeleteBatch = useCallback((batch: ImportBatchRow) => {
    setTargetBatch(batch);
    setForceDeleteBatch(false);
    setLastDeleteBatchResult(null);
    setDeleteBatchOpen(true);
  }, []);

  const deleteBatchNow = useCallback(async () => {
    if (!targetBatch?.id) throw new Error("No batch selected");

    setBusy(true);
    setLastDeleteBatchResult(null);

    try {
      const { data, error } = await supabase.rpc("rpc_delete_import_batch", {
        p_import_batch_id: targetBatch.id,
        p_force: forceDeleteBatch,
      });

      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      const parsed: DeleteBatchResult = {
        import_batch_id: String(row?.import_batch_id ?? targetBatch.id),
        upload_id: String(row?.upload_id ?? uploadId),
        deleted_contacts: Number(row?.deleted_contacts ?? 0),
        deleted_call_logs: Number(row?.deleted_call_logs ?? 0),
        deleted_contact_edits: Number(row?.deleted_contact_edits ?? 0),
        deleted_import_issues: Number(row?.deleted_import_issues ?? 0),
      };

      setLastDeleteBatchResult(parsed);
      return parsed;
    } finally {
      setBusy(false);
    }
  }, [targetBatch, forceDeleteBatch, uploadId]);

  return {
    busy,

    purgeOpen,
    setPurgeOpen,
    preview,
    previewError,
    purgeMode,
    setPurgeMode,
    confirmText,
    setConfirmText,
    lastPurgeResult,
    openPurge,
    loadPreview,
    purgeNow,

    deleteBatchOpen,
    setDeleteBatchOpen,
    targetBatch,
    forceDeleteBatch,
    setForceDeleteBatch,
    lastDeleteBatchResult,
    openDeleteBatch,
    deleteBatchNow,
  };
}

export type CampaignPurgeVM = ReturnType<typeof useCampaignPurge>;