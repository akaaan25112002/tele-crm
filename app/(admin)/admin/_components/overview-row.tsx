export function OverviewRow(props: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border p-3">
      <div className="text-sm opacity-80">{props.label}</div>
      <div className="text-sm font-medium tabular-nums">{props.value}</div>
    </div>
  );
}