export function MiniStat(props: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl bg-muted/40 p-3">
      <div className="text-[11px] opacity-60">{props.label}</div>
      <div className="mt-1 font-medium tabular-nums">{props.value}</div>
    </div>
  );
}