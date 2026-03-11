import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export function DashboardAttention(props: {
  items: Array<{ title: string; detail: string; href?: string }>;
  topIssueCampaign?: { upload_id?: string; campaign_name: string; issue_count: number } | null;
}) {
  return (
    <Card className="min-h-0">
      <CardHeader className="pb-3">
        <CardTitle>Needs Attention</CardTitle>
      </CardHeader>

      <CardContent>
        <div className="max-h-[560px] overflow-y-auto pr-1 space-y-3">
          {props.items.map((item, idx) =>
            item.href ? (
              <Link
                key={idx}
                href={item.href}
                className="block rounded-xl border p-4 transition hover:bg-muted/40"
              >
                <div className="text-sm font-medium">{item.title}</div>
                <div className="mt-1 text-sm opacity-70">{item.detail}</div>
              </Link>
            ) : (
              <div key={idx} className="rounded-xl border p-4">
                <div className="text-sm font-medium">{item.title}</div>
                <div className="mt-1 text-sm opacity-70">{item.detail}</div>
              </div>
            )
          )}

          {props.topIssueCampaign && props.topIssueCampaign.issue_count > 0 ? (
            <Link
              href={`/admin/uploads/${props.topIssueCampaign.upload_id}?tab=audit`}
              className="block rounded-xl border p-4 transition hover:bg-muted/40"
            >
              <div className="text-sm font-medium">Highest issue campaign in recent list</div>
              <div className="mt-1 text-sm opacity-70">
                {props.topIssueCampaign.campaign_name} currently has{" "}
                <span className="font-medium">{props.topIssueCampaign.issue_count}</span> import issues.
              </div>
            </Link>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}