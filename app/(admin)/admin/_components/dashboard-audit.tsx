import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { AuditSummary, AuditTopUpload } from "../_lib/dashboard.types";
import { MetricInline } from "./metric-inline";
import { Button } from "@/components/ui/button";

export function DashboardAudit(props: {
  auditSummary: AuditSummary | null;
  auditTopUploads: AuditTopUpload[];
}) {
  const { auditSummary, auditTopUploads } = props;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Import Audit Summary</CardTitle>

          <Link href="/admin/uploads?issues=has_recent">
            <Button variant="outline" size="sm">
              Open issue campaigns
            </Button>
          </Link>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          <Link href="/admin/uploads?issues=has_recent" className="block">
            <MetricInline title="Issues (7d)" value={auditSummary?.total_issues_7d ?? 0} />
          </Link>

          <Link href="/admin/uploads?issues=has_recent" className="block">
            <MetricInline title="Affected Uploads" value={auditSummary?.affected_uploads_7d ?? 0} />
          </Link>

          <div>
            <MetricInline title="Top Reason" value={auditSummary?.top_reason ?? "—"} />
          </div>

          <div>
            <MetricInline title="Top Reason Count" value={auditSummary?.top_reason_count ?? 0} />
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="space-y-3">
            <div className="text-sm font-medium">Top Problematic Campaigns (7d)</div>

            {auditTopUploads.length === 0 ? (
              <div className="text-sm opacity-70">No notable audit issues in the last 7 days.</div>
            ) : (
              <div className="max-h-[320px] overflow-y-auto pr-1 space-y-3">
                {auditTopUploads.map((row) => (
                  <div
                    key={row.upload_id}
                    className="flex items-center justify-between rounded-xl border p-3"
                  >
                    <Link
                      href={`/admin/uploads/${row.upload_id}?tab=audit`}
                      className="min-w-0 text-sm font-medium line-clamp-1 hover:underline"
                    >
                      {row.campaign_name}
                    </Link>
                    <div className="text-sm tabular-nums opacity-80">{row.issue_count}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="text-sm font-medium">Operational Notes</div>

            <div className="rounded-xl border p-4 text-sm opacity-80">
              Completion % in recent campaigns is based on terminal progress:
              <span className="font-medium"> DONE + INVALID </span>
              over total contacts, matching your backend completion logic.
            </div>

            <div className="rounded-xl border p-4 text-sm opacity-80">
              Overdue callback is derived from the latest call snapshot via
              <span className="font-medium"> next_call_at &lt; now()</span> while contact remains in
              <span className="font-medium"> CALLBACK</span>.
            </div>

            <div className="rounded-xl border p-4 text-sm opacity-80">
              Stale assigned contacts are contacts still marked
              <span className="font-medium"> ASSIGNED </span>
              but already past
              <span className="font-medium"> lease_expires_at</span>.
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}