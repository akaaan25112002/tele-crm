import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getStatusStyle,
  getStatusLabel,
  normalizeStatus,
  type StatusKind,
} from "@/lib/crm/status-theme";

type Props = {
  kind: StatusKind;
  status: string;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
};

export function StatusButton({
  kind,
  status,
  active,
  onClick,
  disabled,
  className,
}: Props) {
  const s = normalizeStatus(status);

  // reuse badge style, but make it button-like
  const base = getStatusStyle(kind, s);

  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-8 rounded-md px-3 text-xs font-medium border transition",
        base,
        active ? "ring-2 ring-ring" : "opacity-90 hover:opacity-100",
        className
      )}
    >
      {getStatusLabel(kind, s)}
    </Button>
  );
}