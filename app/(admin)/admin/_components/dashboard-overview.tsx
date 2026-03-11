import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { DashboardSummary } from "../_lib/dashboard.types";
import { pct, statusBarPercent } from "../_lib/dashboard.utils";
import { PipelineRow } from "./pipeline-row";

function LinkRow(props: {
  label: string;
  value: string | number;
  href: string;
}) {
  return (
    <Link
      href={props.href}
      className="flex items-center justify-between rounded-xl border p-3 transition hover:bg-muted/40"
    >
      <div className="text-sm opacity-80">{props.label}</div>
      <div className="text-sm font-medium tabular-nums">{props.value}</div>
    </Link>
  );
}

export function DashboardOverview(props: {
  summary: DashboardSummary;
}) {
  const { summary } = props;
  const pipelineTotal = summary.total_contacts || 0;
  const terminalWidth = statusBarPercent(summary.terminal_contacts, pipelineTotal);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Campaign Health</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <LinkRow label="Total Campaigns" value={summary.total_campaigns} href="/admin/uploads" />
          <LinkRow label="Running" value={summary.running_campaigns} href="/admin/uploads?status=RUNNING" />
          <LinkRow label="Paused" value={summary.paused_campaigns} href="/admin/uploads?status=PAUSE" />
          <LinkRow label="Completed" value={summary.completed_campaigns} href="/admin/uploads?status=COMPLETED" />
          <LinkRow label="Manual Done" value={summary.manual_done_campaigns} href="/admin/uploads?status=DONE" />
          <LinkRow
            label="Running Without Activity Today"
            value={summary.running_no_activity_today}
            href="/admin/uploads?status=RUNNING&activity=today_none"
          />
          <LinkRow
            label="Import Issues (7d)"
            value={summary.total_import_issues_7d}
            href="/admin/uploads?issues=has_recent"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Contact Pipeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Link href="/admin/contacts?status=NEW" className="block">
            <PipelineRow label="NEW" value={summary.new_contacts} total={pipelineTotal} />
          </Link>

          <Link href="/admin/contacts?status=ASSIGNED" className="block">
            <PipelineRow label="ASSIGNED" value={summary.assigned_contacts} total={pipelineTotal} />
          </Link>

          <Link href="/admin/contacts?status=CALLBACK" className="block">
            <PipelineRow label="CALLBACK" value={summary.callback_contacts} total={pipelineTotal} />
          </Link>

          <Link href="/admin/contacts?status=DONE" className="block">
            <PipelineRow label="DONE" value={summary.done_contacts} total={pipelineTotal} />
          </Link>

          <Link href="/admin/contacts?status=INVALID" className="block">
            <PipelineRow label="INVALID" value={summary.invalid_contacts} total={pipelineTotal} />
          </Link>

          <Link
            href="/admin/contacts?terminal=1"
            className="block rounded-xl border p-3 text-sm transition hover:bg-muted/40"
          >
            <div className="flex items-center justify-between">
              <span className="opacity-70">Terminal Progress</span>
              <span className="font-medium tabular-nums">{pct(terminalWidth)}</span>
            </div>

            <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-foreground/70"
                style={{ width: `${terminalWidth}%` }}
              />
            </div>

            <div className="mt-2 text-xs opacity-70">
              {summary.terminal_contacts} / {pipelineTotal} contacts đã ở trạng thái terminal.
            </div>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}