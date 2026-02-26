export function normalizeVNPhone(input?: string | null) {
  if (!input) return null;
  let s = String(input).trim();
  if (!s) return null;

  // keep digits and +
  s = s.replace(/[^\d+]/g, "");

  // +84xxxxxxxxx => 0xxxxxxxxx
  if (s.startsWith("+84")) s = "0" + s.slice(3);

  // 84xxxxxxxxx => 0xxxxxxxxx
  if (s.startsWith("84") && s.length >= 10) s = "0" + s.slice(2);

  // remove leading zeros like 000...
  s = s.replace(/^0+/, "0");

  if (s === "0") return null;
  return s;
}

export function buildNormalizedPhone(tel?: string, cc?: string, mobile?: string) {
  const merged = `${cc ?? ""}${mobile ?? ""}`;
  const m = normalizeVNPhone(merged);
  if (m && m.length >= 9) return m;

  const t = normalizeVNPhone(tel ?? "");
  return t;
}