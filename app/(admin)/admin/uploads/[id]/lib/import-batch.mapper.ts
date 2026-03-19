import Papa from "papaparse";
import * as XLSX from "xlsx";
import { buildNormalizedPhone } from "@/lib/crm/phone";
import type { AppendMappedRow } from "./import-batch.types";

type Row = Record<string, any>;

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

function asStringOrNull(x: any): string | null {
  if (x === null || x === undefined) return null;
  const s = String(x).trim();
  return s ? s : null;
}

function normEmail(email?: string | null): string | null {
  const s = String(email ?? "").trim().toLowerCase();
  return s ? s : null;
}

function parseImportDate(raw: any): string | null {
  if (raw === null || raw === undefined || raw === "") return null;

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

function safeLower(x: any): string {
  return String(x ?? "").trim().toLowerCase();
}

function safeRaw(x: any): string {
  return String(x ?? "").trim();
}

async function sha256Hex(input: string) {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

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

function fixNameAnomaly(company: string | null, given: string | null, family: string | null) {
  const c = (company ?? "").trim().toLowerCase();
  const g = (given ?? "").trim().toLowerCase();
  const f = (family ?? "").trim();

  if (!c) return { given, family };
  if (!g) return { given, family };
  if (g === c && !f) return { given: null, family: family ?? null };
  return { given, family };
}

export const TEMPLATE_REQUIRED_HEADERS = [
  "person id",
  "company name",
  "email",
  "telephone number",
];

export function validateTemplateHeaders(firstRowRaw: Row) {
  const rr = normalizeRow(firstRowRaw);
  const missing: string[] = [];
  for (const h of TEMPLATE_REQUIRED_HEADERS) {
    if (rr[h] === undefined) missing.push(h);
  }
  return missing;
}

export function parseFile(file: File): Promise<Row[]> {
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

export async function mapRowsForAppend(rows: Row[]): Promise<AppendMappedRow[]> {
  const mapped: AppendMappedRow[] = [];

  for (let idx = 0; idx < rows.length; idx++) {
    const rr = normalizeRow(rows[idx]);

    const external_person_id_raw = asStringOrNull(pick(rr, ["person id", "personid", "external_person_id"]));
    const external_person_id = external_person_id_raw ? external_person_id_raw.trim() : null;

    const company_info = asStringOrNull(pick(rr, ["company info", "company_info"]));
    const company_name = asStringOrNull(pick(rr, ["company name", "company_name"]));

    let given_name = asStringOrNull(pick(rr, ["given name", "given_name"]));
    let family_name = asStringOrNull(pick(rr, ["family name", "family_name"]));

    ({ given: given_name, family: family_name } = fixNameAnomaly(company_name, given_name, family_name));

    const job_title = asStringOrNull(pick(rr, ["job title", "job_title"]));
    const department = asStringOrNull(pick(rr, ["department"]));
    const country = asStringOrNull(pick(rr, ["country"]));

    const email = asStringOrNull(pick(rr, ["email"]));
    const normalized_email = normEmail(email);

    const email_second = asStringOrNull(
      pick(rr, ["email (second)", "email second", "email_2", "email2", "email_second"])
    );

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
      row_no: idx + 1,
      import_date,
      source_status: asStringOrNull(pick(rr, ["status"])),
      external_person_id,
      company_info,
      company_name,
      given_name,
      family_name,
      job_title,
      department,
      country,
      email,
      email_second,
      telephone_number: asStringOrNull(tel),
      mobile_country_code: asStringOrNull(cc),
      mobile_number: asStringOrNull(mn),
      normalized_phone,
      normalized_email,
      address_line1,
      address_line2,
      address_line3,
      city_ward,
      state,
      registered_event,
      visited_event,
      source_row_key,
    });
  }

  return mapped;
}