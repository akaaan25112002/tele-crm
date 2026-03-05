export function normalizeVNPhone(input?: string | null) {
  if (!input) return null;
  let s = String(input).trim();
  if (!s) return null;

  // keep digits and +
  s = s.replace(/[^\d+]/g, "");

  // normalize VN formats
  if (s.startsWith("+84")) s = "0" + s.slice(3);
  if (s.startsWith("84") && s.length >= 10) s = "0" + s.slice(2);

  // collapse leading zeros: 0009 -> 09
  s = s.replace(/^0+/, "0");

  if (s === "0") return null;

  // basic sanity: VN mobile/phone usually 9-11 digits starting with 0
  const digits = s.replace(/[^\d]/g, "");
  if (!digits.startsWith("0")) return null;
  if (digits.length < 9 || digits.length > 11) return null;

  return digits; // return digits only, stable for indexing
}

export function buildNormalizedPhone(tel?: string | null, cc?: string | null, mobile?: string | null) {
  // 1) try mobile first (if provided)
  const mRaw = `${cc ?? ""}${mobile ?? ""}`.trim();
  const m = normalizeVNPhone(mRaw);
  if (m) return m;

  // 2) fallback tel
  const t = normalizeVNPhone(tel ?? "");
  return t;
}