import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Status =
  | "NEW"
  | "ASSIGNED"
  | "CALLBACK"
  | "DONE"
  | "INVALID"
  | "READY"
  | "IMPORTING"
  | "FAILED"
  | string;

const STATUS_STYLES: Record<string, string> = {
  // ===== CONTACT STATUSES =====
  NEW: "bg-sky-100 text-sky-800 border-sky-200",
  ASSIGNED: "bg-indigo-100 text-indigo-800 border-indigo-200",
  CALLBACK: "bg-amber-100 text-amber-900 border-amber-200",
  DONE: "bg-emerald-100 text-emerald-800 border-emerald-200",
  INVALID: "bg-rose-100 text-rose-800 border-rose-200",

  // ===== UPLOAD STATUSES =====
  READY: "bg-sky-100 text-sky-800 border-sky-200",
  IMPORTING: "bg-amber-100 text-amber-900 border-amber-200",
  FAILED: "bg-rose-100 text-rose-800 border-rose-200",
};

const FALLBACK =
  "bg-slate-100 text-slate-700 border-slate-200";

export function StatusBadge({
  status,
  className,
}: {
  status: Status;
  className?: string;
}) {
  const s = (status ?? "")
    .toString()
    .trim()
    .toUpperCase();

  const styles = STATUS_STYLES[s] ?? FALLBACK;

  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md border px-2 py-0.5 text-xs font-medium",
        styles,
        className
      )}
    >
      {s || "—"}
    </Badge>
  );
}