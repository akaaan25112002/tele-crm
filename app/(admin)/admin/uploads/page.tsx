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
import { Textarea } from "@/components/ui/textarea";

type CampaignStatus = "RUNNING" | "PAUSE" | "COMPLETED" | "DONE";

type Upload = {
  id: string;
  campaign_name: string;
  description: string | null;
  created_at: string;
  total_rows: number;
  status: CampaignStatus;
};

type Row = Record<string, any>;

function normalizeCampaignStatus(x: any): CampaignStatus {
  const s = String(x ?? "").trim().toUpperCase();
  if (s === "RUNNING") return "RUNNING";
  if (s === "PAUSE" || s === "PAUSED") return "PAUSE";
  if (s === "COMPLETED") return "COMPLETED";
  if (s === "DONE") return "DONE";
  // fallback an toàn
  return "RUNNING";
}

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

function parseImportDate(raw: any): string | null {
  if (raw === null || raw === undefined || raw === "") return null;

  // Excel date number
  if (typeof raw === "number" && isFinite(raw)) {
    const utc = Math.round((raw - 25569) * 86400 * 1000);
    const d = new Date(utc);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  const s = String(raw).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);
    const d = new Date(yyyy, mm - 1, dd);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function asStringOrNull(x: any): string | null {
  if (x === null || x === undefined) return null;
  const s = String(x).trim();
  return s ? s : null;
}

export default function AdminUploadsPage() {
  const router = useRouter();

  const [uploads, setUploads] = useState<Upload[]>([]);
  const [campaignName, setCampaignName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [log, setLog] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("uploads")
      .select("id,campaign_name,description,created_at,total_rows,status")
      .order("created_at", { ascending: false });

    if (error) console.error(error);

    const normalized: Upload[] = (((data as any[]) ?? []) as any[]).map((u) => ({
      id: String(u.id),
      campaign_name: String(u.campaign_name ?? ""),
      description: u.description ?? null,
      created_at: String(u.created_at),
      total_rows: Number(u.total_rows ?? 0),
      status: normalizeCampaignStatus(u.status),
    }));

    setUploads(normalized);
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

      const { data: upload, error: upErr } = await supabase
        .from("uploads")
        .insert({
          campaign_name: campaignName.trim(),
          description: description.trim() || null,
          filename: file.name,
          uploaded_by: uid,
          total_rows: rows.length,
          status: "RUNNING",
        })
        .select("id")
        .single();

      if (upErr) throw upErr;
      uploadId = String(upload.id);

      const mapped = rows.map((r, idx) => {
        const rr = normalizeRow(r);

        const tel = pick(rr, [
          "telephone number",
          "telephone_number",
          "telephonenumber",
          "telephone",
          "phone",
          "telephone number ",
        ]);
        const cc = pick(rr, ["mobile country code", "mobile_country_code", "country code", "mobile cc"]);
        const mn = pick(rr, ["mobile number", "mobile_number", "mobile", "mobile no", "mobile phone"]);

        const normalized = buildNormalizedPhone(tel ? String(tel) : "", cc ? String(cc) : "", mn ? String(mn) : "");
        const normalized_phone = normalized && String(normalized).trim() ? String(normalized).trim() : null;

        const rawDate = pick(rr, ["date", "import date", "import_date"]);
        const import_date = parseImportDate(rawDate);

        return {
          upload_id: uploadId,
          row_no: idx + 1,
          import_date,
          current_status: "NEW",

          source_status: asStringOrNull(pick(rr, ["status"])),
          external_person_id: asStringOrNull(pick(rr, ["person id", "personid", "external_person_id"])),

          telephone_number: asStringOrNull(tel),
          mobile_country_code: asStringOrNull(cc),
          mobile_number: asStringOrNull(mn),
          normalized_phone,

          company_name: asStringOrNull(pick(rr, ["company name", "company_name"])),
          given_name: asStringOrNull(pick(rr, ["given name", "given_name"])),
          family_name: asStringOrNull(pick(rr, ["family name", "family_name"])),
          job_title: asStringOrNull(pick(rr, ["job title", "job_title"])),
          department: asStringOrNull(pick(rr, ["department"])),
          email: asStringOrNull(pick(rr, ["email"])),

          address_line1: asStringOrNull(pick(rr, ["address-line1", "address line1", "address_line1", "address 1"])),
          address_line2: asStringOrNull(pick(rr, ["address-line2", "address line2", "address_line2", "address 2"])),
          address_line3: asStringOrNull(pick(rr, ["address-line3", "address line3", "address_line3", "address 3"])),
          city_ward: asStringOrNull(pick(rr, ["city/ward", "city", "ward", "city_ward"])),
          state: asStringOrNull(pick(rr, ["state"])),
          country: asStringOrNull(pick(rr, ["country"])),
        };
      });

      const chunkSize = 500;
      const totalChunks = Math.ceil(mapped.length / chunkSize);

      setLog(`Inserting contacts in chunks of ${chunkSize}...`);

      for (let i = 0; i < mapped.length; i += chunkSize) {
        const chunkIndex = Math.floor(i / chunkSize) + 1;
        const chunk = mapped.slice(i, i + chunkSize);

        const { error } = await supabase.from("contacts").insert(chunk);
        if (error) throw new Error(`Insert failed at chunk ${chunkIndex}/${totalChunks}: ${error.message}`);

        setLog(`Inserted ${Math.min(i + chunkSize, mapped.length)}/${mapped.length} (chunk ${chunkIndex}/${totalChunks})`);
      }

      setLog("Refreshing upload status...");
      try {
        const { error: refreshErr } = await supabase.rpc("refresh_upload_status", { p_upload_id: uploadId });
        if (refreshErr) {
          console.warn("refresh_upload_status rpc failed:", refreshErr);
          setLog((prev) => prev + `\n⚠ refresh_upload_status failed: ${refreshErr.message}`);
        }
      } catch (e: any) {
        console.warn("refresh_upload_status unexpected:", e);
      }

      setLog("Done ✅");
      await load();
      router.push(`/admin/uploads/${uploadId}`);
    } catch (e: any) {
      console.error(e);
      setLog(`Failed ❌\n${e?.message ?? String(e)}`);

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

          <Textarea
            placeholder="Description (optional): ghi chú về campaign, target, script, v.v."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={busy}
            rows={3}
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
              <Link key={u.id} href={`/admin/uploads/${u.id}`} className="group block focus:outline-none">
                <Card className="h-full transition-all hover:shadow-md hover:-translate-y-[1px] focus-visible:ring-2 focus-visible:ring-ring">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle className="text-base leading-5 line-clamp-2">{u.campaign_name}</CardTitle>
                      <StatusBadge status={u.status} kind="campaign" />
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    {u.description ? <div className="text-xs opacity-70 line-clamp-2 mb-2">{u.description}</div> : null}

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="space-y-1">
                        <div className="text-xs opacity-60">Rows</div>
                        <div className="font-medium tabular-nums">{u.total_rows}</div>
                      </div>

                      <div className="space-y-1">
                        <div className="text-xs opacity-60">Created</div>
                        <div className="font-medium">{new Date(u.created_at).toLocaleString()}</div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-end text-xs opacity-70">
                      <span className="transition-transform group-hover:translate-x-0.5">View →</span>
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