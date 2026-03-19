"use client";

import { useCallback, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { mapRowsForAppend, parseFile, validateTemplateHeaders } from "../lib/import-batch.mapper";
import type { AppendImportResult, AppendMappedRow, DuplicatePolicy } from "../lib/import-batch.types";

export function useCampaignAppendImport(uploadId: string) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [duplicatePolicy, setDuplicatePolicy] = useState<DuplicatePolicy>("SKIP");
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewName, setPreviewName] = useState<string>("");
  const [mappedRows, setMappedRows] = useState<AppendMappedRow[]>([]);
  const [result, setResult] = useState<AppendImportResult | null>(null);
  const [log, setLog] = useState("");

  const reset = useCallback(() => {
    setBusy(false);
    setFile(null);
    setNotes("");
    setDuplicatePolicy("SKIP");
    setPreviewCount(null);
    setPreviewName("");
    setMappedRows([]);
    setResult(null);
    setLog("");
  }, []);

  const prepareFile = useCallback(async (f: File) => {
    setFile(f);
    setResult(null);
    setLog("Parsing file...");

    const rows = await parseFile(f);
    if (!rows.length) throw new Error("File has no data rows.");

    const missing = validateTemplateHeaders(rows[0]);
    if (missing.length) {
      throw new Error(
        `Template headers missing: ${missing.join(", ")}.\nPlease upload đúng template.`
      );
    }

    setLog(`Mapping ${rows.length} rows...`);
    const mapped = await mapRowsForAppend(rows);

    setMappedRows(mapped);
    setPreviewCount(mapped.length);
    setPreviewName(f.name);
    setLog(`Ready to append ${mapped.length} rows.`);
  }, []);

  const appendNow = useCallback(async () => {
    if (!uploadId) throw new Error("Missing uploadId");
    if (!file) throw new Error("Please choose a file");
    if (!mappedRows.length) throw new Error("No mapped rows to append");

    setBusy(true);
    setResult(null);

    try {
      setLog("Creating import batch...");
      const { data: batchData, error: batchErr } = await supabase.rpc("rpc_create_import_batch", {
        p_upload_id: uploadId,
        p_filename: file.name,
        p_import_mode: "APPEND",
        p_notes: notes.trim() || null,
      });

      if (batchErr) throw batchErr;

      const batch = Array.isArray(batchData) ? batchData[0] : batchData;
      const batchId = String(batch?.id ?? "");
      if (!batchId) throw new Error("Failed to create import batch");

      setLog(`Appending ${mappedRows.length} rows into campaign...`);
      const { data, error } = await supabase.rpc("rpc_append_contacts_to_campaign", {
        p_upload_id: uploadId,
        p_import_batch_id: batchId,
        p_rows: mappedRows,
        p_duplicate_policy: duplicatePolicy,
      });

      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      const parsed: AppendImportResult = {
        batch_id: String(row?.batch_id ?? batchId),
        total_rows: Number(row?.total_rows ?? 0),
        inserted_rows: Number(row?.inserted_rows ?? 0),
        duplicate_rows: Number(row?.duplicate_rows ?? 0),
        failed_rows: Number(row?.failed_rows ?? 0),
        skipped_rows: Number(row?.skipped_rows ?? 0),
      };

      setResult(parsed);
      setLog(
        `Completed.\nInserted: ${parsed.inserted_rows}\nDuplicate: ${parsed.duplicate_rows}\nFailed: ${parsed.failed_rows}\nSkipped: ${parsed.skipped_rows}`
      );

      return parsed;
    } catch (e) {
      throw e;
    } finally {
      setBusy(false);
    }
  }, [uploadId, file, mappedRows, notes, duplicatePolicy]);

  return {
    open,
    setOpen,
    busy,
    file,
    setFile,
    notes,
    setNotes,
    duplicatePolicy,
    setDuplicatePolicy,
    previewCount,
    previewName,
    mappedRows,
    result,
    log,
    reset,
    prepareFile,
    appendNow,
  };
}

export type CampaignAppendImportVM = ReturnType<typeof useCampaignAppendImport>;