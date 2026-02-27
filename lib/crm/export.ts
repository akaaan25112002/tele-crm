export function toCSV(rows: Record<string, any>[]) {
  const BOM = "\uFEFF"; // 👈 fix Excel Vietnamese encoding

  if (!rows.length) return BOM;

  const headers = Object.keys(rows[0]);

  const escape = (v: any) => {
    const s = v === null || v === undefined ? "" : String(v);
    // thêm \r để an toàn Windows
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const lines = [
    headers.map(escape).join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ];

  // 👇 prepend BOM + dùng CRLF cho Excel Windows
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