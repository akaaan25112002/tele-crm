import type { DashboardSummary } from "../_lib/dashboard.types";
import { healthTone } from "../_lib/dashboard.utils";

export function DashboardHealthBanner(props: {
  summary: DashboardSummary;
}) {
  const { summary } = props;

  return (
    <div className={`rounded-2xl border px-4 py-3 ${healthTone(summary.health)}`}>
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm font-medium">System Health</div>
          <div className="text-lg font-semibold">{summary.health}</div>
        </div>
        <div className="text-sm opacity-90">
          {summary.running_campaigns} running · {summary.calls_today} calls today ·{" "}
          {summary.overdue_callbacks} overdue callbacks
        </div>
      </div>
    </div>
  );
}