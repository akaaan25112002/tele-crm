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

type Upload = {
  id: string;
  campaign_name: string;
  created_at: string;
  total_rows: number;
  status: string;
};

type Row = Record<string, any>;

function parseFile(file: File): Promise<Row[]> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "csv") {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => resolve((res.data as any[]) ?? []),
        error: (e) => reject(e),
      });
    });
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const data = new Uint8Array(reader.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Row[];
      resolve(json);
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function normalizeRow(r: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(r)) out[k.trim().toLowerCase()] = v;
  return out;
}

function pick(r: Row, keys: string[]) {
  for (const k of keys) {
    const v = r[k.trim().toLowerCase()];
    if (v !== undefined) return v;
  }
  return undefined;
}

function parseImportDate(raw: any): Date | null {
  if (raw === null || raw === undefined || raw === "") return null;

  if (typeof raw === "number") {
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
    setUploads((data as any) ?? []);
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

      setLog(`Creating upload record... (${rows.length} rows)`);
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id ?? null;

      const { data: upload, error: upErr } = await supabase
        .from("uploads")
        .insert({
          campaign_name: campaignName.trim(),
          filename: file.name,
          uploaded_by: uid,
          total_rows: rows.length,
          status: "IMPORTING",
        })
        .select("id")
        .single();

      if (upErr) throw upErr;

      uploadId = upload.id as string;

      // Map rows
      const mapped = rows.map((r, idx) => {
        const rr = normalizeRow(r);

        const tel = pick(rr, ["telephone number", "telephone_number", "telephonenumber"]);
        const cc = pick(rr, ["mobile country code", "mobile_country_code"]);
        const mn = pick(rr, ["mobile number", "mobile_number"]);

        const normalized_phone = buildNormalizedPhone(
          tel ? String(tel) : "",
          cc ? String(cc) : "",
          mn ? String(mn) : ""
        );

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

      // Batch insert
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

      await supabase.from("uploads").update({ status: "DONE" }).eq("id", uploadId);

      setLog("Done ✅");
      await load();
      router.push(`/admin/uploads/${uploadId}`);
    } catch (e: any) {
      console.error(e);
      setLog(`Failed ❌\n${e?.message ?? String(e)}`);

      if (uploadId) {
        await supabase.from("uploads").update({ status: "FAILED" }).eq("id", uploadId);
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

      <div className="space-y-2">
        <div className="text-lg font-semibold">Recent Uploads</div>
        <div className="grid md:grid-cols-2 gap-3">
          {uploads.map((u) => (
            <Link key={u.id} href={`/admin/uploads/${u.id}`}>
              <Card className="hover:shadow-md transition">
                <CardHeader>
                  <CardTitle className="text-base">{u.campaign_name}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm opacity-80">
                  Rows: {u.total_rows} • Status: {u.status}
                  <br />
                  {new Date(u.created_at).toLocaleString()}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}