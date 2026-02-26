"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase/client";
import { buildNormalizedPhone } from "@/lib/crm/phone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";

type CampaignStatus = "RUNNING" | "PAUSE" | "COMPLETED" | "DONE";

type Upload = {
  id: string;
  campaign_name: string;
  created_at: string;
  total_rows: number;
  status: CampaignStatus;
};

type Row = Record<string, any>;

function parseFile(file: File): Promise<Row[]> {
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (ext === "csv") {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => resolve(((res.data as any[]) ?? []) as Row[]),
        error: (e) => reject(e),
      });
    });
  }

  if (ext === "xlsx" || ext === "xls") {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = new Uint8Array(reader.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Row[];
          resolve(json);
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  return Promise.reject(new Error("Unsupported file type. Use .csv, .xlsx, or .xls"));
}

function normalizeRow(r: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(r)) out[String(k).trim().toLowerCase()] = v;
  return out;
}

function pick(r: Row, keys: string[]) {
  for (const k of keys) {
    const v = r[String(k).trim().toLowerCase()];
    if (v !== undefined) return v;
  }
  return undefined;
}

function parseImportDate(raw: any): Date | null {
  if (raw === null || raw === undefined || raw === "") return null;

  // Excel serial date
  if (typeof raw === "number" && isFinite(raw)) {
    const utc = Math.round((raw - 25569) * 86400 * 1000);
    const d = new Date(utc);
    return isNaN(d.getTime()) ? null : d;
  }

  const s = String(raw).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);
    const d = new Date(yyyy, mm - 1, dd);
    return isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export default function AdminUploadsPage() {
  const router = useRouter();

  const [uploads, setUploads] = useState<Upload[]>([]);
  const [campaignName, setCampaignName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [log, setLog] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("uploads")
      .select("id,campaign_name,created_at,total_rows,status")
      .order("created_at", { ascending: false });

    if (error) console.error(error);
    setUploads(((data as any) ?? []) as Upload[]);
  };

  useEffect(() => {
    load();
  }, []);

  const importNow = async () => {
    if (!file) return;
    if (!campaignName.trim()) return alert("Campaign name required");

    setBusy(true);
    setLog("");

    let uploadId: string | null = null;

    try {
      setLog("Parsing file...");
      const rows = await parseFile(file);

      if (!rows.length) throw new Error("File has no data rows.");

      setLog(`Creating upload record... (${rows.length} rows)`);

      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id ?? null;

      // ✅ Use enum-valid status: RUNNING
      const { data: upload, error: upErr } = await supabase
        .from("uploads")
        .insert({
          campaign_name: campaignName.trim(),
          filename: file.name,
          uploaded_by: uid,
          total_rows: rows.length,
          status: "RUNNING" satisfies CampaignStatus,
        })
        .select("id")
        .single();

      if (upErr) throw upErr;
      uploadId = upload.id as string;

      // Map rows -> contacts payload
      const mapped = rows.map((r, idx) => {
        const rr = normalizeRow(r);

        const tel = pick(rr, ["telephone number", "telephone_number", "telephonenumber"]);
        const cc = pick(rr, ["mobile country code", "mobile_country_code"]);
        const mn = pick(rr, ["mobile number", "mobile_number"]);

        const normalized = buildNormalizedPhone(
          tel ? String(tel) : "",
          cc ? String(cc) : "",
          mn ? String(mn) : ""
        );

        const normalized_phone = normalized && String(normalized).trim() ? String(normalized).trim() : null;

        const rawDate = pick(rr, ["date", "import date", "import_date"]);
        const import_date = parseImportDate(rawDate);

        return {
          upload_id: uploadId,
          row_no: idx + 1,
          import_date,
          source_status: pick(rr, ["status"]) ?? null,
          external_person_id: pick(rr, ["person id", "personid", "external_person_id"]) ?? null,

          telephone_number: tel ? String(tel) : null,
          mobile_country_code: cc ? String(cc) : null,
          mobile_number: mn ? String(mn) : null,
          normalized_phone,

          company_name: pick(rr, ["company name", "company_name"]) ?? null,
          given_name: pick(rr, ["given name", "given_name"]) ?? null,
          family_name: pick(rr, ["family name", "family_name"]) ?? null,
          job_title: pick(rr, ["job title", "job_title"]) ?? null,
          department: pick(rr, ["department"]) ?? null,
          email: pick(rr, ["email"]) ?? null,

          address_line1: pick(rr, ["address-line1", "address line1", "address_line1"]) ?? null,
          address_line2: pick(rr, ["address-line2", "address line2", "address_line2"]) ?? null,
          address_line3: pick(rr, ["address-line3", "address line3", "address_line3"]) ?? null,
          city_ward: pick(rr, ["city/ward", "city", "ward", "city_ward"]) ?? null,
          state: pick(rr, ["state"]) ?? null,
          country: pick(rr, ["country"]) ?? null,
        };
      });

      // Batch insert contacts
      const chunkSize = 500;
      const totalChunks = Math.ceil(mapped.length / chunkSize);

      setLog(`Inserting contacts in chunks of ${chunkSize}...`);

      for (let i = 0; i < mapped.length; i += chunkSize) {
        const chunkIndex = Math.floor(i / chunkSize) + 1;
        const chunk = mapped.slice(i, i + chunkSize);

        const { error } = await supabase.from("contacts").insert(chunk);
        if (error) {
          throw new Error(`Insert failed at chunk ${chunkIndex}/${totalChunks}: ${error.message}`);
        }

        setLog(
          `Inserted ${Math.min(i + chunkSize, mapped.length)}/${mapped.length} (chunk ${chunkIndex}/${totalChunks})`
        );
      }

      // ✅ Let backend be source of truth for status
      // Call refresh_upload_status(uploadId) if exists; otherwise triggers should handle.
      setLog("Refreshing upload status...");
      const { error: refreshErr } = await supabase.rpc("refresh_upload_status", { p_upload_id: uploadId });
      if (refreshErr) {
        // Not fatal; you may rely on triggers. But log it for debugging.
        console.warn("refresh_upload_status rpc failed:", refreshErr);
        setLog((prev) => prev + `\n⚠ refresh_upload_status failed: ${refreshErr.message}\n(Triggers may still update status)`);
      }

      setLog("Done ✅");
      await load();
      router.push(`/admin/uploads/${uploadId}`);
    } catch (e: any) {
      console.error(e);
      setLog(`Failed ❌\n${e?.message ?? String(e)}`);

      // ✅ enum-valid "failed" fallback: PAUSE
      if (uploadId) {
        await supabase.from("uploads").update({ status: "PAUSE" }).eq("id", uploadId);
      }

      alert(e?.message ?? "Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Import Campaign</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Campaign name (e.g., Event Dec 2025)"
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            disabled={busy}
          />

          <Input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={busy}
          />

          <Button onClick={importNow} disabled={!file || busy}>
            {busy ? "Importing..." : "Import"}
          </Button>

          {log && <div className="text-sm opacity-80 whitespace-pre-wrap">{log}</div>}
        </CardContent>
      </Card>

      {/* Recent Uploads */}
      <div className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-lg font-semibold">Recent Uploads</div>
            <div className="text-sm opacity-70">
              {uploads.length ? `Showing ${uploads.length} latest campaigns` : "No campaigns yet"}
            </div>
          </div>
        </div>

        {uploads.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm opacity-70">
              No uploads yet. Import your first campaign above.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {uploads.map((u) => (
              <Link
                key={u.id}
                href={`/admin/uploads/${u.id}`}
                className="group block focus:outline-none"
              >
                <Card className="h-full transition-all hover:shadow-md hover:-translate-y-[1px] focus-visible:ring-2 focus-visible:ring-ring">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle className="text-base leading-5 line-clamp-2">
                        {u.campaign_name}
                      </CardTitle>

                      {/* Status pill */}
                      <StatusBadge status={u.status} kind="campaign" />
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="space-y-1">
                        <div className="text-xs opacity-60">Rows</div>
                        <div className="font-medium tabular-nums">{u.total_rows}</div>
                      </div>

                      <div className="space-y-1">
                        <div className="text-xs opacity-60">Created</div>
                        <div className="font-medium">
                          {new Date(u.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-end text-xs opacity-70">
                      <span className="transition-transform group-hover:translate-x-0.5">
                        View →
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}