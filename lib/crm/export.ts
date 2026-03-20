import * as XLSX from "xlsx";

/*
====================================================
CSV EXPORT
====================================================
*/

export function toCSV(rows: Record<string, any>[], headers?: string[]) {
  const BOM = "\uFEFF";

  if (!rows.length) {
    if (headers?.length) return BOM + headers.join(",") + "\r\n";
    return BOM;
  }

  const cols = headers?.length ? headers : Object.keys(rows[0]);

  const escape = (v: any) => {
    const s = v === null || v === undefined ? "" : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const lines = [
    cols.map(escape).join(","),
    ...rows.map((r) => cols.map((h) => escape(r[h])).join(",")),
  ];

  return BOM + lines.join("\r\n");
}

export function downloadText(
  filename: string,
  content: string,
  mime = "text/csv;charset=utf-8"
) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;

  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

/*
====================================================
FETCH PAGINATION (Supabase safe)
====================================================
*/

export async function fetchAllByRange<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
  pageSize = 1000
): Promise<T[]> {
  if (!Number.isFinite(pageSize) || pageSize <= 0) {
    throw new Error("fetchAllByRange: pageSize must be > 0");
  }

  const out: T[] = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const page = await fetchPage(from, to);

    if (!Array.isArray(page)) {
      throw new Error("fetchAllByRange: fetchPage must return an array");
    }

    if (page.length === 0) break;

    out.push(...page);

    // Nếu page cuối nhỏ hơn pageSize => đã hết dữ liệu
    if (page.length < pageSize) break;

    from += pageSize;
  }

  return out;
}

/*
====================================================
XLSX EXPORT
====================================================
*/

function autoColumnWidth(rows: Record<string, any>[], headers: string[]) {
  return headers.map((h) => {
    const max = Math.max(
      h.length,
      ...rows.map((r) => String(r[h] ?? "").length)
    );

    return { wch: Math.min(Math.max(max + 2, 10), 50) };
  });
}

export function downloadWorkbookXlsx(
  filename: string,
  sheets: {
    name: string;
    rows: Record<string, any>[];
    headers: string[];
  }[]
) {
  const wb = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const headers = sheet.headers;

    const normalized = sheet.rows.map((r) => {
      const obj: Record<string, any> = {};
      for (const h of headers) obj[h] = r[h] ?? "";
      return obj;
    });

    const ws = XLSX.utils.json_to_sheet(normalized, {
      header: headers,
    });

    ws["!freeze"] = { xSplit: 0, ySplit: 1 };

    ws["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: normalized.length, c: headers.length - 1 },
      }),
    };

    ws["!cols"] = autoColumnWidth(normalized, headers);

    XLSX.utils.book_append_sheet(
      wb,
      ws,
      sheet.name.slice(0, 31)
    );
  }

  wb.Props = {
    Title: "Campaign Export",
    Author: "Tele CRM",
    CreatedDate: new Date(),
  };

  const finalName = filename.toLowerCase().endsWith(".xlsx")
    ? filename
    : `${filename}.xlsx`;

  XLSX.writeFile(wb, finalName);
}