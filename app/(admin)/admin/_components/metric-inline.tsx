export function MetricInline(props: {
  title: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border p-4">
      <div className="text-xs opacity-70">{props.title}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{props.value}</div>
    </div>
  );
}