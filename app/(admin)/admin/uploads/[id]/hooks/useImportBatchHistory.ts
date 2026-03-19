"use client";

import { useCallback, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { ImportBatchRow } from "../lib/import-batch.types";

export function useImportBatchHistory(uploadId: string) {
  const [rows, setRows] = useState<ImportBatchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  const load = useCallback(async () => {
    if (!uploadId) return;

    setLoading(true);
    setErrorText("");

    try {
      const { data, error } = await supabase
        .from("v_import_batches_admin")
        .select("*")
        .eq("upload_id", uploadId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setRows((((data as any[]) ?? []) as any[]).map((x) => ({
        id: String(x.id),
        upload_id: String(x.upload_id),
        campaign_name: x.campaign_name ?? null,
        filename: x.filename ?? null,
        imported_by: x.imported_by ? String(x.imported_by) : null,
        imported_by_name: x.imported_by_name ?? null,
        import_mode: String(x.import_mode ?? "APPEND") as any,
        total_rows: Number(x.total_rows ?? 0),
        inserted_rows: Number(x.inserted_rows ?? 0),
        skipped_rows: Number(x.skipped_rows ?? 0),
        duplicate_rows: Number(x.duplicate_rows ?? 0),
        failed_rows: Number(x.failed_rows ?? 0),
        status: String(x.status ?? "PROCESSING") as any,
        notes: x.notes ?? null,
        created_at: String(x.created_at),
        completed_at: x.completed_at ? String(x.completed_at) : null,
      })));
    } catch (e: any) {
      console.error(e);
      setRows([]);
      setErrorText(e?.message ?? "Load import batch history failed");
    } finally {
      setLoading(false);
    }
  }, [uploadId]);

  return {
    rows,
    loading,
    errorText,
    load,
  };
}

export type ImportBatchHistoryVM = ReturnType<typeof useImportBatchHistory>;