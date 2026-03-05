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

function normEmail(email?: string | null): string | null {
  const s = String(email ?? "").trim().toLowerCase();
  return s ? s : null;
}

function safeLower(x: any): string {
  return String(x ?? "").trim().toLowerCase();
}
function safeRaw(x: any): string {
  return String(x ?? "").trim();
}

/** client-safe sha256 */
async function sha256Hex(input: string) {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * ✅ Template columns (case-insensitive)
 * Person ID, Company Info, Company Name, Given Name, Family Name,
 * Job Title, Department, Country, Email, Email (Second),
 * Telephone Number, Mobile Number, Address-Line1, City, State,
 * Registered Event, Visited Event
 */
const TEMPLATE_REQUIRED_HEADERS = [
  "person id",
  "company name",
  "email",
  "telephone number",
];

/** Validate header existence to catch wrong template / broken CSV parsing early */
function validateTemplateHeaders(firstRowRaw: Row) {
  const rr = normalizeRow(firstRowRaw);
  const missing: string[] = [];
  for (const h of TEMPLATE_REQUIRED_HEADERS) {
    if (rr[h] === undefined) missing.push(h);
  }
  return missing;
}

/**
 * source_row_key: stable-ish fallback for tracing rows (not used for dedupe policy now)
 */
async function buildSourceRowKey(rr: Row) {
  const external_person_id = safeRaw(pick(rr, ["person id", "personid", "external_person_id"]));
  const email = safeLower(pick(rr, ["email"]));
  const email2 = safeLower(
    pick(rr, ["email (second)", "email second", "email_2", "email2", "email_second"])
  );

  const company = safeLower(pick(rr, ["company name", "company_name"]));
  const given = safeLower(pick(rr, ["given name", "given_name"]));
  const family = safeLower(pick(rr, ["family name", "family_name"]));

  const tel = safeRaw(
    pick(rr, ["telephone number", "telephone_number", "telephonenumber", "telephone", "phone", "telephone number "])
  );
  const cc = safeRaw(pick(rr, ["mobile country code", "mobile_country_code", "country code", "mobile cc"]));
  const mn = safeRaw(pick(rr, ["mobile number", "mobile_number", "mobile", "mobile no", "mobile phone"]));

  const job = safeLower(pick(rr, ["job title", "job_title"]));
  const dept = safeLower(pick(rr, ["department"]));
  const city = safeLower(pick(rr, ["city", "city/ward", "ward", "city_ward"]));
  const state = safeLower(pick(rr, ["state"]));
  const country = safeLower(pick(rr, ["country"]));

  const regEvt = safeLower(pick(rr, ["registered event", "registered_event"]));
  const visEvt = safeLower(pick(rr, ["visited event", "visited_event"]));

  const parts = [
    external_person_id || "",
    email || "",
    email2 || "",
    company || "",
    given || "",
    family || "",
    tel || "",
    cc || "",
    mn || "",
    job || "",
    dept || "",
    city || "",
    state || "",
    country || "",
    regEvt || "",
    visEvt || "",
  ];

  return sha256Hex(parts.join("|"));
}

type ContactInsert = {
  upload_id: string;
  row_no: number | null;
  import_date: string | null;
  current_status: string;

  source_status: string | null;
  external_person_id: string | null;

  telephone_number: string | null;
  mobile_country_code: string | null;
  mobile_number: string | null;
  normalized_phone: string | null;

  company_info: string | null;
  company_name: string | null;

  given_name: string | null;
  family_name: string | null;

  job_title: string | null;
  department: string | null;

  email: string | null;
  email_second: string | null;

  address_line1: string | null;
  address_line2: string | null;
  address_line3: string | null;
  city_ward: string | null;
  state: string | null;
  country: string | null;

  registered_event: string | null;
  visited_event: string | null;

  normalized_email: string | null;
  normalized_email_second: string | null;

  source_row_key: string | null;
};

type DropReason = "DEDUPE_TRIPLE";

type ImportIssueRow = {
  upload_id: string;
  row_no: number | null;
  reason: DropReason;
  identity_key: string | null;
  kept_row_no: number | null;
  details: any;
};

function chunkify<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function summarizeRow(x: ContactInsert) {
  return {
    row_no: x.row_no,
    external_person_id: x.external_person_id,
    normalized_email: x.normalized_email,
    normalized_email_second: x.normalized_email_second,
    email: x.email,
    email_second: x.email_second,
    normalized_phone: x.normalized_phone,
    telephone_number: x.telephone_number,
    company_name: x.company_name,
    given_name: x.given_name,
    family_name: x.family_name,
    job_title: x.job_title,
    department: x.department,
    city_ward: x.city_ward,
    state: x.state,
    country: x.country,
    registered_event: x.registered_event,
    visited_event: x.visited_event,
    source_row_key: x.source_row_key,
  };
}

/**
 * Dedupe ONLY when all 3 identities exist:
 * external_person_id + normalized_email + normalized_phone
 * last-row-wins
 */
function tripleKeyOf(x: ContactInsert): string | null {
  const pid = (x.external_person_id ?? "").trim();
  const em = (x.normalized_email ?? "").trim();
  const ph = (x.normalized_phone ?? "").trim();

  if (!pid || !em || !ph) return null;
  return `${x.upload_id}||${pid}||${em}||${ph}`;
}

function auditDedupeTriple(uploadId: string, rows: ContactInsert[]) {
  const keep = new Map<string, ContactInsert>();
  const issues: ImportIssueRow[] = [];

  for (const r of rows) {
    const k = tripleKeyOf(r);
    if (!k) continue;

    const prev = keep.get(k);
    if (prev) {
      issues.push({
        upload_id: uploadId,
        row_no: prev.row_no ?? null,
        reason: "DEDUPE_TRIPLE",
        identity_key: k,
        kept_row_no: r.row_no ?? null,
        details: {
          dropped: summarizeRow(prev),
          kept: summarizeRow(r),
          note: "Duplicate triple (PersonID + Email + Phone) in file; last row wins.",
        },
      });
    }
    keep.set(k, r);
  }

  // remove dropped ones from rows (only for triple-dup)
  const droppedRowNos = new Set<number>();
  for (const it of issues) {
    if (typeof it.row_no === "number") droppedRowNos.add(it.row_no);
  }

  const keptRows = rows.filter((r) => !(typeof r.row_no === "number" && droppedRowNos.has(r.row_no)));

  return { kept: keptRows, issues };
}

async function persistIssues(uploadId: string, issues: ImportIssueRow[]) {
  // Always rewrite for upload_id (best effort)
  try {
    await supabase.from("contact_import_issues").delete().eq("upload_id", uploadId);
  } catch {}

  if (!issues.length) return;

  const chunks = chunkify(issues, 500);
  for (const ch of chunks) {
    const { error } = await supabase.from("contact_import_issues").insert(ch);
    if (error) throw new Error(`Save import audit failed: ${error.message}`);
  }
}

/** Heuristic guard: prevent saving company_name into given_name when person name is missing */
function fixNameAnomaly(company: string | null, given: string | null, family: string | null) {
  const c = (company ?? "").trim().toLowerCase();
  const g = (given ?? "").trim().toLowerCase();
  const f = (family ?? "").trim();

  if (!c) return { given, family };
  if (!g) return { given, family };

  // If given == company and family empty -> very likely shifted CSV / wrong mapping -> null it
  if (g === c && !f) {
    return { given: null, family: family ?? null };
  }
  return { given, family };
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

      // ✅ Validate template headers early (catch wrong delimiter / broken CSV)
      const missing = validateTemplateHeaders(rows[0]);
      if (missing.length) {
        throw new Error(
          `Template headers missing: ${missing.join(", ")}.\n` +
            `Please upload đúng template.\n` +
            `Nếu CSV có dấu phẩy trong Company Info/Company Name, hãy đảm bảo các ô được quote (\"...\") hoặc dùng XLSX.`
        );
      }

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

      setLog("Mapping rows (template map + normalize phone/email + build source_row_key)...");
      const mapped: ContactInsert[] = [];

      for (let idx = 0; idx < rows.length; idx++) {
        const rr = normalizeRow(rows[idx]);

        // Template keys (+ safe aliases)
        const external_person_id_raw = asStringOrNull(pick(rr, ["person id", "personid", "external_person_id"]));
        const external_person_id = external_person_id_raw ? external_person_id_raw.trim() : null;

        const company_info = asStringOrNull(pick(rr, ["company info", "company_info"]));
        const company_name = asStringOrNull(pick(rr, ["company name", "company_name"]));

        let given_name = asStringOrNull(pick(rr, ["given name", "given_name"]));
        let family_name = asStringOrNull(pick(rr, ["family name", "family_name"]));

        // ✅ Fix anomaly: company duplicated into given name when person name missing
        ({ given: given_name, family: family_name } = fixNameAnomaly(company_name, given_name, family_name));

        const job_title = asStringOrNull(pick(rr, ["job title", "job_title"]));
        const department = asStringOrNull(pick(rr, ["department"]));
        const country = asStringOrNull(pick(rr, ["country"]));

        const email = asStringOrNull(pick(rr, ["email"]));
        const normalized_email = normEmail(email);

        const email_second = asStringOrNull(
          pick(rr, ["email (second)", "email second", "email_2", "email2", "email_second"])
        );
        const normalized_email_second = normEmail(email_second);

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

        const address_line1 = asStringOrNull(pick(rr, ["address-line1", "address line1", "address_line1", "address 1"]));
        const address_line2 = asStringOrNull(pick(rr, ["address-line2", "address line2", "address_line2", "address 2"]));
        const address_line3 = asStringOrNull(pick(rr, ["address-line3", "address line3", "address_line3", "address 3"]));

        const city_ward = asStringOrNull(pick(rr, ["city", "city/ward", "ward", "city_ward"]));
        const state = asStringOrNull(pick(rr, ["state"]));

        const registered_event = asStringOrNull(pick(rr, ["registered event", "registered_event"]));
        const visited_event = asStringOrNull(pick(rr, ["visited event", "visited_event"]));

        const source_row_key = await buildSourceRowKey(rr);

        mapped.push({
          upload_id: uploadId,
          row_no: idx + 1,
          import_date,
          current_status: "NEW",

          source_status: asStringOrNull(pick(rr, ["status"])),
          external_person_id,

          telephone_number: asStringOrNull(tel),
          mobile_country_code: asStringOrNull(cc),
          mobile_number: asStringOrNull(mn),
          normalized_phone,

          company_info,
          company_name,

          given_name,
          family_name,

          job_title,
          department,

          email,
          email_second,

          address_line1,
          address_line2,
          address_line3,
          city_ward,
          state,
          country,

          registered_event,
          visited_event,

          normalized_email,
          normalized_email_second,

          source_row_key,
        });
      }

      // ✅ DEDUPE ONLY triple (pid+email+phone)
      const aud = auditDedupeTriple(uploadId, mapped);
      const kept = aud.kept;
      const issues = aud.issues;

      setLog((prev) => prev + `\nAudit triple-duplicate issues: ${issues.length}`);
      try {
        await persistIssues(uploadId, issues);
        setLog((prev) => prev + `\nAudit saved ✅`);
      } catch (e: any) {
        setLog((prev) => prev + `\n⚠ Audit save failed: ${e?.message ?? String(e)}`);
      }

      type Payload = ContactInsert;
      const payload: Payload[] = kept;

      const upsertChunked = async <T extends Record<string, any>>(
        label: string,
        rowsToUpsert: T[],
        onConflict: string,
        ignoreDuplicates: boolean
      ) => {
        if (!rowsToUpsert.length) {
          setLog((prev) => prev + `\n${label}: 0 rows (skip)`);
          return;
        }
        const chunks = chunkify(rowsToUpsert, 500);
        setLog((prev) => prev + `\n${label}: ${rowsToUpsert.length} rows → ${chunks.length} chunks`);

        for (let i = 0; i < chunks.length; i++) {
          const { error } = await supabase.from("contacts").upsert(chunks[i], { onConflict, ignoreDuplicates });
          if (error) throw new Error(`${label} failed at chunk ${i + 1}/${chunks.length}: ${error.message}`);
        }
      };

      setLog((prev) => prev + `\nUpserting contacts...`);

      // ✅ Must match DB unique index
      const ON_CONFLICT = "upload_id,external_person_id,normalized_email,normalized_phone";

      await upsertChunked("ALL) Insert rows (triple-dedupe only)", payload, ON_CONFLICT, true);

      setLog((prev) => prev + "\nRefreshing upload status...");
      try {
        await supabase.rpc("refresh_upload_status", { p_upload_id: uploadId });
      } catch {}

      setLog((prev) => prev + "\nDone ✅ Redirecting to audit tab...");
      await load();

      router.push(`/admin/uploads/${uploadId}?tab=audit`);
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