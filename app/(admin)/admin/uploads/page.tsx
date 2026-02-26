"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase/client";
import { buildNormalizedPhone } from "@/lib/crm/phone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type Upload = { id: string; campaign_name: string; created_at: string; total_rows: number; status: string };

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

function pick(r: Row, keys: string[]) {
  for (const k of keys) {
    if (r[k] !== undefined) return r[k];
  }
  return undefined;
}

export default function AdminUploadsPage() {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [campaignName, setCampaignName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [log, setLog] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("uploads")
      .select("id,campaign_name,created_at,total_rows,status")
      .order("created_at", { ascending: false });
    setUploads((data as any) ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const importNow = async () => {
    if (!file) return;
    if (!campaignName.trim()) return alert("Campaign name required");

    setBusy(true);
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
        status: "READY",
      })
      .select("id")
      .single();

    if (upErr) {
      setBusy(false);
      return alert(upErr.message);
    }
    const uploadId = upload.id as string;

    // Map headers theo CSV mẫu của bạn
    const mapped = rows.map((r, idx) => {
      const tel = pick(r, ["Telephone Number", "Telephone_Number", "TelephoneNumber"]);
      const cc = pick(r, ["Mobile Country Code", "Mobile_Country_Code"]);
      const mn = pick(r, ["Mobile Number", "Mobile_Number"]);

      const normalized_phone = buildNormalizedPhone(
        tel ? String(tel) : "",
        cc ? String(cc) : "",
        mn ? String(mn) : ""
      );

      // DATE có thể là string dd/mm/yyyy -> giữ null nếu parse lỗi
      const rawDate = pick(r, ["DATE", "Date"]);
      const import_date = rawDate ? new Date(String(rawDate)) : null;

      return {
        upload_id: uploadId,
        row_no: idx + 1,
        import_date: isNaN(import_date as any) ? null : import_date,
        source_status: pick(r, ["Status"]) ?? null,
        external_person_id: pick(r, ["Person ID", "PersonID"]) ?? null,

        telephone_number: tel ? String(tel) : null,
        mobile_country_code: cc ? String(cc) : null,
        mobile_number: mn ? String(mn) : null,
        normalized_phone,

        company_name: pick(r, ["Company Name"]) ?? null,
        given_name: pick(r, ["Given Name"]) ?? null,
        family_name: pick(r, ["Family Name"]) ?? null,
        job_title: pick(r, ["Job Title"]) ?? null,
        department: pick(r, ["Department"]) ?? null,
        email: pick(r, ["Email"]) ?? null,

        address_line1: pick(r, ["Address-Line1", "Address Line1"]) ?? null,
        address_line2: pick(r, ["Address-Line2", "Address Line2"]) ?? null,
        address_line3: pick(r, ["Address-Line3", "Address Line3"]) ?? null,
        city_ward: pick(r, ["City/Ward", "City", "Ward"]) ?? null,
        state: pick(r, ["State"]) ?? null,
        country: pick(r, ["Country"]) ?? null,
      };
    });

    // Batch insert
    const chunkSize = 500;
    setLog(`Inserting contacts in chunks of ${chunkSize}...`);

    for (let i = 0; i < mapped.length; i += chunkSize) {
      const chunk = mapped.slice(i, i + chunkSize);
      const { error } = await supabase.from("contacts").insert(chunk);
      if (error) {
        setBusy(false);
        return alert(`Insert failed at chunk ${i / chunkSize}: ${error.message}`);
      }
      setLog(`Inserted ${Math.min(i + chunkSize, mapped.length)}/${mapped.length}`);
    }

    setBusy(false);
    setLog("Done ✅");
    await load();
    window.location.href = `/admin/uploads/${uploadId}`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Import Campaign</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Campaign name (e.g., Event Dec 2025)"
            value={campaignName}
            onChange={(e)=>setCampaignName(e.target.value)}
            disabled={busy}
          />
          <Input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e)=>setFile(e.target.files?.[0] ?? null)}
            disabled={busy}
          />
          <Button onClick={importNow} disabled={!file || busy}>
            {busy ? "Importing..." : "Import"}
          </Button>
          {log && <div className="text-sm opacity-80 whitespace-pre-wrap">{log}</div>}
          <div className="text-xs opacity-60">
            MVP importer chạy trên browser. File rất lớn (100k+) có thể chậm.
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <div className="text-lg font-semibold">Recent Uploads</div>
        <div className="grid md:grid-cols-2 gap-3">
          {uploads.map((u) => (
            <Link key={u.id} href={`/admin/uploads/${u.id}`}>
              <Card className="hover:shadow-md transition">
                <CardHeader><CardTitle className="text-base">{u.campaign_name}</CardTitle></CardHeader>
                <CardContent className="text-sm opacity-80">
                  Rows: {u.total_rows} • Status: {u.status}<br/>
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