import type { ImportBatchStatus, PurgeMode } from "./import-batch.types";

export function fmtDTFull(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export function safeFileBaseName(name: string) {
  return String(name ?? "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w\-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

export function importBatchStatusTone(status?: string | null) {
  const s = String(status ?? "").trim().toUpperCase() as ImportBatchStatus;
  if (s === "COMPLETED") return "bg-emerald-600 text-white hover:bg-emerald-600";
  if (s === "FAILED") return "bg-rose-600 text-white hover:bg-rose-600";
  if (s === "ROLLED_BACK") return "bg-amber-500 text-black hover:bg-amber-500";
  return "bg-slate-600 text-white hover:bg-slate-600";
}

export function purgeModeLabel(mode: PurgeMode) {
  if (mode === "UNTOUCHED_ONLY") return "Untouched only";
  if (mode === "ALL_CONTACTS") return "All contacts";
  return "Force with history";
}