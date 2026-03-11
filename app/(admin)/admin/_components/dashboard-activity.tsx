import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { RecentActivityRow } from "../_lib/dashboard.types";
import { fmtDT } from "../_lib/dashboard.utils";
import { Button } from "@/components/ui/button";

function todayIsoDate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function DashboardActivity(props: {
  recentActivity: RecentActivityRow[];
}) {
  const { recentActivity } = props;
  const today = todayIsoDate();

  return (
    <Card className="min-h-0">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Recent Call Activity</CardTitle>

          <Link href={`/admin/call-logs?date_from=${today}&date_to=${today}`}>
            <Button variant="outline" size="sm">
              Open today logs
            </Button>
          </Link>
        </div>
      </CardHeader>

      <CardContent>
        {recentActivity.length === 0 ? (
          <div className="text-sm opacity-70">No recent call activity.</div>
        ) : (
          <div className="max-h-[620px] overflow-y-auto pr-1 space-y-3">
            {recentActivity.map((item) => (
              <Link
                key={item.call_log_id}
                href={`/admin/call-logs?upload_id=${item.upload_id}`}
                className="block rounded-xl border p-4 transition hover:bg-muted/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium line-clamp-1">{item.campaign_name}</div>
                    <div className="mt-1 text-xs opacity-70">
                      {item.tele_name || "Unknown tele"} · {fmtDT(item.called_at)}
                    </div>
                  </div>

                  <div className="text-xs font-medium uppercase opacity-70">
                    {item.final_status || "—"}
                  </div>
                </div>

                <div className="mt-2 text-sm opacity-80">
                  {item.group_name || "—"} {item.detail_name ? `· ${item.detail_name}` : ""}
                </div>

                <div className="mt-3 text-xs opacity-60">
                  Click to open full call logs for this campaign
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}