import Link from "next/link";
import type { DashboardSummary } from "../_lib/dashboard.types";
import { MetricCard } from "./metric-card";

function todayIsoDate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function DashboardKpis(props: {
  summary: DashboardSummary;
}) {
  const { summary } = props;
  const today = todayIsoDate();

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
      <Link href="/admin/uploads?status=RUNNING" className="block">
        <MetricCard title="Running Campaigns" value={summary.running_campaigns} helper="Đang hoạt động" />
      </Link>

      <Link href="/admin/uploads?status=PAUSE" className="block">
        <MetricCard title="Paused Campaigns" value={summary.paused_campaigns} helper="Đang tạm dừng" />
      </Link>

      <Link href="/admin/contacts" className="block">
        <MetricCard title="Total Contacts" value={summary.total_contacts} helper="Toàn hệ thống" />
      </Link>

      <Link href="/admin/contacts?status=NEW" className="block">
        <MetricCard title="New Contacts" value={summary.new_contacts} helper="Chưa xử lý" />
      </Link>

      <Link href="/admin/contacts?status=ASSIGNED" className="block">
        <MetricCard title="Assigned Contacts" value={summary.assigned_contacts} helper="Đang giữ active lease" />
      </Link>

      <Link href="/admin/contacts?status=CALLBACK" className="block">
        <MetricCard title="Callback Contacts" value={summary.callback_contacts} helper="Cần follow-up" />
      </Link>

      <Link href="/admin/contacts?status=DONE" className="block">
        <MetricCard title="Done Contacts" value={summary.done_contacts} helper="Hoàn tất" />
      </Link>

      <Link href={`/admin/call-logs?date_from=${today}&date_to=${today}`} className="block">
        <MetricCard title="Calls Today" value={summary.calls_today} helper="Activity hôm nay" />
      </Link>
    </div>
  );
}