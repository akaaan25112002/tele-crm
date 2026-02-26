"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { toCSV, downloadText } from "@/lib/crm/export";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Upload = { id: string; campaign_name: string; filename: string | null; total_rows: number; status: string; created_at: string };
type StatusCount = { current_status: string; count: number };

export default function UploadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [upload, setUpload] = useState<Upload | null>(null);
  const [counts, setCounts] = useState<StatusCount[]>([]);
  const [busy, setBusy] = useState(false);

  const totalCount = useMemo(() => counts.reduce((s, x) => s + (x.count ?? 0), 0), [counts]);

  const load = async () => {
    const { data: u } = await supabase
      .from("uploads")
      .select("id,campaign_name,filename,total_rows,status,created_at")
      .eq("id", id)
      .single();

    setUpload((u as any) ?? null);

    // group-by status (Supabase doesn't do group-by easily in client)
    const { data: contacts } = await supabase
      .from("contacts")
      .select("current_status")
      .eq("upload_id", id);

    const m = new Map<string, number>();
    ((contacts as any[]) ?? []).forEach((r) => {
      const k = r.current_status ?? "UNKNOWN";
      m.set(k, (m.get(k) ?? 0) + 1);
    });

    setCounts([...m.entries()].map(([current_status, count]) => ({ current_status, count })));
  };

  useEffect(() => {
    load();
  }, [id]);

  const exportReport = async () => {
    setBusy(true);

    // NOTE: nếu upload cực lớn, query này sẽ nặng (MVP chấp nhận).
    const { data, error } = await supabase
      .from("v_contacts_report")
      .select("*")
      .eq("upload_id", id);

    setBusy(false);
    if (error) return alert(error.message);

    const rows = (data as any[]) ?? [];
    const csv = toCSV(rows);
    const name = `${upload?.campaign_name ?? "report"}_${id}.csv`.replace(/[^\w\-]+/g, "_");
    downloadText(name, csv);
  };

  const exportLogs = async () => {
    setBusy(true);
    const { data, error } = await supabase
      .from("v_call_logs_export")
      .select("*")
      .eq("upload_id", id)
      .order("called_at", { ascending: true });

    setBusy(false);
    if (error) return alert(error.message);

    const rows = (data as any[]) ?? [];
    const csv = toCSV(rows);
    const name = `${upload?.campaign_name ?? "call_logs"}_${id}.csv`.replace(/[^\w\-]+/g, "_");
    downloadText(name, csv);
  };

  if (!upload) return null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Campaign</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2">
          <div><b>Name:</b> {upload.campaign_name}</div>
          <div><b>File:</b> {upload.filename ?? "—"}</div>
          <div className="flex gap-2 items-center">
            <b>Status:</b> <Badge>{upload.status}</Badge>
          </div>
          <div><b>Total rows (declared):</b> {upload.total_rows}</div>
          <div><b>Contacts in DB:</b> {totalCount}</div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={exportReport} disabled={busy}>
              {busy ? "Exporting..." : "Export Report (v_contacts_report)"}
            </Button>
            <Button variant="outline" onClick={exportLogs} disabled={busy}>
              {busy ? "Exporting..." : "Export Call Logs"}
            </Button>
            <Button variant="outline" onClick={load} disabled={busy}>
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Progress by status</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-3">
          {counts
            .sort((a, b) => a.current_status.localeCompare(b.current_status))
            .map((x) => (
              <div key={x.current_status} className="p-3 rounded-lg border">
                <div className="text-xs opacity-70">{x.current_status}</div>
                <div className="text-2xl font-semibold">{x.count}</div>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}