import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export function MetricCard(props: {
  title: string;
  value: string | number;
  helper?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium opacity-80">{props.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tabular-nums">{props.value}</div>
        {props.helper ? <div className="mt-1 text-xs opacity-70">{props.helper}</div> : null}
      </CardContent>
    </Card>
  );
}