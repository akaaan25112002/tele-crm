import type { AssigneeFilter, CampaignStatus } from "./types";

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function fmtDT(s: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export function asStringOrNull(x: any): string | null {
  if (x === null || x === undefined) return null;
  const s = String(x).trim();
  return s ? s : null;
}

export function normalizeCampaignStatus(x: any): CampaignStatus {
  const s = String(x ?? "").trim().toUpperCase();
  if (s === "RUNNING") return "RUNNING";
  if (s === "PAUSE" || s === "PAUSED") return "PAUSE";
  if (s === "COMPLETED") return "COMPLETED";
  if (s === "DONE") return "DONE";
  return "RUNNING";
}

export function isLeaseActive(lease_expires_at: string | null) {
  if (!lease_expires_at) return false;
  return new Date(lease_expires_at).getTime() > Date.now();
}

export function isTerminalStatus(st: any) {
  const s = String(st ?? "").toUpperCase();
  return s === "DONE" || s === "INVALID";
}

export function assigneeFilterToValue(x: AssigneeFilter): string {
  if (x.type === "ALL") return "ALL";
  if (x.type === "UNASSIGNED") return "UNASSIGNED";
  return `TELE:${x.teleId}`;
}

export function assigneeValueToFilter(v: string): AssigneeFilter {
  if (v === "ALL") return { type: "ALL" };
  if (v === "UNASSIGNED") return { type: "UNASSIGNED" };
  if (v.startsWith("TELE:")) return { type: "TELE", teleId: v.slice("TELE:".length) };
  return { type: "ALL" };
}