import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  guessKind,
  getStatusLabel,
  getStatusStyle,
  normalizeStatus,
  type StatusKind,
} from "@/lib/crm/status-theme";

type Props = {
  status: string;
  kind?: StatusKind; // "contact" | "campaign"
  className?: string;
};

export function StatusBadge({ status, kind, className }: Props) {
  const s = normalizeStatus(status);
  const k = kind ?? guessKind(s);

  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md border px-2 py-0.5 text-xs font-medium",
        getStatusStyle(k, s),
        className
      )}
    >
      {getStatusLabel(k, s)}
    </Badge>
  );
}