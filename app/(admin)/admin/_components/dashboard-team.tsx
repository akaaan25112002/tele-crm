import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { TeamRow } from "../_lib/dashboard.types";
import { fmtDT } from "../_lib/dashboard.utils";
import { MiniStat } from "./mini-stat";
import { Button } from "@/components/ui/button";

function todayIsoDate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function DashboardTeam(props: {
  team: TeamRow[];
}) {
  const { team } = props;
  const today = todayIsoDate();

  return (
    <Card className="min-h-0">
      <CardHeader className="pb-3">
        <CardTitle>Tele Team Snapshot</CardTitle>
      </CardHeader>

      <CardContent>
        {team.length === 0 ? (
          <div className="text-sm opacity-70">No team data found.</div>
        ) : (
          <div className="max-h-[620px] overflow-y-auto pr-1 space-y-3">
            {team.map((row, idx) => (
              <div key={row.tele_id} className="rounded-2xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      #{idx + 1} · {row.full_name}
                    </div>
                    <div className="mt-1 text-xs opacity-70">
                      Last call: {fmtDT(row.last_call_at)}
                    </div>
                  </div>

                  <div className="text-right text-xs opacity-70">
                    Active holding: <span className="font-medium">{row.active_holding}</span>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                  <MiniStat label="Calls Today" value={row.calls_today} />
                  <MiniStat label="Done Today" value={row.done_today} />
                  <MiniStat label="Callback Today" value={row.callback_today} />
                  <MiniStat label="Invalid Today" value={row.invalid_today} />
                  <MiniStat label="Assigned Holding" value={row.assigned_holding} />
                  <MiniStat label="Callback Holding" value={row.callback_holding} />
                  <MiniStat label="Expired Leases" value={row.expired_leases} />
                  <MiniStat label="Active Holding" value={row.active_holding} />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/admin/contacts?assigned_to=${row.tele_id}`}>
                    <Button variant="outline" size="sm">
                      Assigned contacts
                    </Button>
                  </Link>

                  <Link href={`/admin/call-logs?tele_id=${row.tele_id}`}>
                    <Button variant="outline" size="sm">
                      All call logs
                    </Button>
                  </Link>

                  <Link href={`/admin/call-logs?tele_id=${row.tele_id}&date_from=${today}&date_to=${today}`}>
                    <Button variant="outline" size="sm">
                      Today logs
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}