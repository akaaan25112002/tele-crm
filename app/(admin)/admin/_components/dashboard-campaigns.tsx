import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import type { CampaignRow } from "../_lib/dashboard.types";
import { fmtDT, pct } from "../_lib/dashboard.utils";
import { MiniStat } from "./mini-stat";

export function DashboardCampaigns(props: {
  campaigns: CampaignRow[];
}) {
  const { campaigns } = props;

  return (
    <Card className="min-h-0">
      <CardHeader className="pb-3">
        <CardTitle>Recent Campaigns</CardTitle>
      </CardHeader>

      <CardContent>
        {campaigns.length === 0 ? (
          <div className="text-sm opacity-70">No campaigns found.</div>
        ) : (
          <div className="max-h-[560px] overflow-y-auto pr-1 space-y-3">
            {campaigns.map((c) => (
              <Link
                key={c.upload_id}
                href={`/admin/uploads/${c.upload_id}`}
                className="block rounded-2xl border p-4 transition hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium line-clamp-1">{c.campaign_name}</div>
                    <div className="mt-1 text-xs opacity-70">{fmtDT(c.created_at)}</div>
                    {c.description ? (
                      <div className="mt-1 text-xs opacity-70 line-clamp-2">{c.description}</div>
                    ) : null}
                  </div>
                  <StatusBadge status={c.status} kind="campaign" />
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                  <MiniStat label="Rows" value={c.total_rows} />
                  <MiniStat label="Contacts" value={c.total_contacts} />
                  <MiniStat label="Calls Today" value={c.calls_today} />
                  <MiniStat label="Completion" value={pct(c.completion_percent)} />
                </div>

                <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-foreground/70"
                    style={{ width: `${Math.max(0, Math.min(100, c.completion_percent))}%` }}
                  />
                </div>

                <div className="mt-3 grid grid-cols-3 gap-3 text-xs opacity-80">
                  <div>NEW: {c.new_contacts}</div>
                  <div>CALLBACK: {c.callback_contacts}</div>
                  <div>Issues: {c.issue_count}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}