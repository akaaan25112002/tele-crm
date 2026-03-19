"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type ImportIssue = {
  id: string;
  upload_id: string;
  import_batch_id?: string | null;
  row_no: number | null;
  reason: string;
  identity_key: string | null;
  kept_row_no: number | null;
  details: any;
  created_at: string;
};

function safeJson(x: any) {
  try {
    return JSON.stringify(x, null, 2);
  } catch {
    return String(x);
  }
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCsvValue(v: any) {
  const s = v === null || v === undefined ? "" : String(v);
  const escaped = s.replace(/"/g, '""');
  return `"${escaped}"`;
}

function buildCsv(rows: ImportIssue[]) {
  const header = [
    "created_at",
    "import_batch_id",
    "reason",
    "row_no",
    "kept_row_no",
    "identity_key",
    "details_json",
  ];
  const lines = [header.join(",")];

  for (const r of rows) {
    lines.push(
      [
        toCsvValue(r.created_at),
        toCsvValue(r.import_batch_id ?? ""),
        toCsvValue(r.reason),
        toCsvValue(r.row_no ?? ""),
        toCsvValue(r.kept_row_no ?? ""),
        toCsvValue(r.identity_key ?? ""),
        toCsvValue(safeJson(r.details)),
      ].join(",")
    );
  }

  return lines.join("\n");
}

export default function ImportAuditConsole(props: {
  uploadId: string;
  refreshToken?: number;
}) {
  const { uploadId, refreshToken } = props;

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ImportIssue[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [reason, setReason] = useState<string>("");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const reasonCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of items) map.set(it.reason, (map.get(it.reason) ?? 0) + 1);
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [items]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return items.filter((it) => {
      if (reason && it.reason !== reason) return false;
      if (!qq) return true;

      const hay = [
        it.reason,
        it.import_batch_id ?? "",
        it.identity_key ?? "",
        String(it.row_no ?? ""),
        String(it.kept_row_no ?? ""),
        safeJson(it.details),
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(qq);
    });
  }, [items, q, reason]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = useMemo(() => {
    const p = Math.min(Math.max(page, 1), totalPages);
    const start = (p - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [q, reason]);

  const load = async () => {
    if (!uploadId) return;
    setLoading(true);
    setErr(null);

    try {
      const { data, error } = await supabase
        .from("contact_import_issues")
        .select("id,upload_id,import_batch_id,row_no,reason,identity_key,kept_row_no,details,created_at")
        .eq("upload_id", uploadId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      setItems(((data as any[]) ?? []) as ImportIssue[]);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "Load audit failed");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [uploadId, refreshToken]);

  const exportCsv = () => {
    const csv = buildCsv(filtered);
    downloadText(`import_audit_${uploadId}.csv`, csv);
  };

  return (
    <Card>
      <CardHeader className="space-y-2">
        <CardTitle className="flex items-center justify-between gap-2">
          <span>Import Audit</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              {loading ? "Loading..." : "Refresh"}
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
              Export CSV
            </Button>
          </div>
        </CardTitle>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Issues: {items.length}</Badge>
          <Badge variant="outline">Filtered: {filtered.length}</Badge>
          <Badge variant="outline">Page: {Math.min(page, totalPages)}/{totalPages}</Badge>
        </div>

        {!!reasonCounts.length && (
          <div className="flex flex-wrap gap-2 text-xs">
            {reasonCounts.map(([r, c]) => (
              <button
                key={r}
                className={`px-2 py-1 rounded border ${
                  reason === r ? "bg-primary text-primary-foreground border-primary" : "bg-background"
                }`}
                onClick={() => setReason(reason === r ? "" : r)}
                type="button"
                title="Click to filter by reason"
              >
                {r} ({c})
              </button>
            ))}
            {reason ? (
              <button className="px-2 py-1 rounded border bg-background" onClick={() => setReason("")} type="button">
                Clear reason
              </button>
            ) : null}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Search in batch/reason/identity_key/details/row_no..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-md"
          />
        </div>

        {err ? <div className="text-sm text-red-600 whitespace-pre-wrap">{err}</div> : null}
      </CardHeader>

      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <div className="text-sm opacity-70">
            {loading ? "Loading audit..." : "No audit issues for this upload."}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="text-xs opacity-70">
                Showing {pageItems.length} of {filtered.length}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {pageItems.map((it) => (
                <div key={it.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{it.reason}</Badge>
                      <span className="text-xs opacity-70">
                        {new Date(it.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="opacity-70">row_no:</span>
                      <span className="font-medium tabular-nums">{it.row_no ?? "—"}</span>
                      <span className="opacity-70">kept_row_no:</span>
                      <span className="font-medium tabular-nums">{it.kept_row_no ?? "—"}</span>
                    </div>
                  </div>

                  {it.import_batch_id ? (
                    <div className="text-xs opacity-70 break-all">
                      batch: {it.import_batch_id}
                    </div>
                  ) : null}

                  {it.identity_key ? (
                    <div className="text-xs font-mono break-all opacity-80">
                      {it.identity_key}
                    </div>
                  ) : null}

                  <details className="text-sm">
                    <summary className="cursor-pointer select-none text-xs opacity-80">
                      Details JSON
                    </summary>
                    <pre className="mt-2 text-xs overflow-auto p-2 rounded bg-muted">
                      {safeJson(it.details)}
                    </pre>
                  </details>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}