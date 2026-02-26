export type ContactStatus = "NEW" | "ASSIGNED" | "CALLBACK" | "INVALID" | "DONE";
export type CampaignStatus = "RUNNING" | "PAUSE" | "COMPLETED" | "DONE";

export type StatusKind = "contact" | "campaign";

export const CONTACT_STATUS_ORDER: ContactStatus[] = [
  "NEW",
  "ASSIGNED",
  "CALLBACK",
  "INVALID",
  "DONE",
];

export const CAMPAIGN_STATUS_ORDER: CampaignStatus[] = [
  "RUNNING",
  "PAUSE",
  "COMPLETED",
  "DONE",
];

// Tailwind utility classes (Badge/Button share)
export const CONTACT_STATUS_STYLE: Record<ContactStatus, string> = {
  NEW: "bg-sky-100 text-sky-800 border-sky-200",
  ASSIGNED: "bg-indigo-100 text-indigo-800 border-indigo-200",
  CALLBACK: "bg-amber-100 text-amber-900 border-amber-200",
  INVALID: "bg-rose-100 text-rose-800 border-rose-200",
  DONE: "bg-emerald-100 text-emerald-800 border-emerald-200", // ✅ positive
};

export const CAMPAIGN_STATUS_STYLE: Record<CampaignStatus, string> = {
  RUNNING: "bg-sky-100 text-sky-800 border-sky-200",
  PAUSE: "bg-amber-100 text-amber-900 border-amber-200",
  COMPLETED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  DONE: "bg-slate-200 text-slate-700 border-slate-300", // ✅ closed
};

export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  RUNNING: "RUNNING",
  PAUSE: "PAUSED",
  COMPLETED: "COMPLETED",
  DONE: "DONE",
};

export const FALLBACK_STYLE = "bg-slate-100 text-slate-700 border-slate-200";

export function normalizeStatus(input: unknown): string {
  return String(input ?? "").trim().toUpperCase();
}

export function guessKind(status: string): StatusKind {
  if (status === "RUNNING" || status === "PAUSE" || status === "COMPLETED") return "campaign";
  return "contact";
}

export function getStatusStyle(kind: StatusKind, statusRaw: unknown): string {
  const s = normalizeStatus(statusRaw);

  if (kind === "campaign") {
    return (CAMPAIGN_STATUS_STYLE as any)[s] ?? FALLBACK_STYLE;
  }
  return (CONTACT_STATUS_STYLE as any)[s] ?? FALLBACK_STYLE;
}

export function getStatusLabel(kind: StatusKind, statusRaw: unknown): string {
  const s = normalizeStatus(statusRaw);

  if (!s) return "—";
  if (kind === "campaign") return (CAMPAIGN_STATUS_LABEL as any)[s] ?? s;
  return s;
}