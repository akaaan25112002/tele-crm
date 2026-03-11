import { pct, statusBarPercent } from "../_lib/dashboard.utils";

export function PipelineRow(props: {
  label: string;
  value: number;
  total: number;
}) {
  const width = statusBarPercent(props.value, props.total);

  return (
    <div className="rounded-xl border p-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">{props.label}</div>
        <div className="text-sm tabular-nums opacity-80">{props.value}</div>
      </div>

      <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-foreground/70"
          style={{ width: `${width}%` }}
        />
      </div>

      <div className="mt-1 text-xs opacity-60">{pct(width)} of total contacts</div>
    </div>
  );
}