"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { toCSV, downloadText } from "@/lib/crm/export";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";

type Upload = {
  id: string;
  campaign_name: string;
  filename: string | null;
  total_rows: number;
  status: string;
  created_at: string;
};

type StatusCount = {
  current_status: string;
  count: number;
};

export default function UploadDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [upload, setUpload] = useState<Upload | null>(null);
  const [counts, setCounts] = useState<StatusCount[]>([]);
  const [busy, setBusy] = useState(false);

  const totalCount = useMemo(
    () => counts.reduce((sum, x) => sum + (x.count ?? 0), 0),
    [counts]
  );

  const load = async () => {
    // Load upload info
    const { data: u, error: uploadError } = await supabase
      .from("uploads")
      .select("id,campaign_name,filename,total_rows,status,created_at")
      .eq("id", id)
      .single();

    if (uploadError) {
      console.error(uploadError);
      return;
    }

    setUpload((u as any) ?? null);

    // Load contacts and group by status (client-side)
    const { data: contacts, error: contactsError } = await supabase
      .from("contacts")
      .select("current_status")
      .eq("upload_id", id);

    if (contactsError) {
      console.error(contactsError);
      return;
    }

    const map = new Map<string, number>();

    ((contacts as any[]) ?? []).forEach((r) => {
      const key = (r.current_status ?? "UNKNOWN").toUpperCase();
      map.set(key, (map.get(key) ?? 0) + 1);
    });

    setCounts(
      [...map.entries()].map(([current_status, count]) => ({
        current_status,
        count,
      }))
    );
  };

  useEffect(() => {
    if (id) load();
  }, [id]);

  const exportReport = async () => {
    setBusy(true);

    const { data, error } = await supabase
      .from("v_contacts_report")
      .select("*")
      .eq("upload_id", id);

    setBusy(false);

    if (error) {
      alert(error.message);
      return;
    }

    const rows = (data as any[]) ?? [];
    const csv = toCSV(rows);

    const filename = `${upload?.campaign_name ?? "report"}_${id}.csv`
      .replace(/[^\w\-]+/g, "_");

    downloadText(filename, csv);
  };

  const exportLogs = async () => {
    setBusy(true);

    const { data, error } = await supabase
      .from("v_call_logs_export")
      .select("*")
      .eq("upload_id", id)
      .order("called_at", { ascending: true });

    setBusy(false);

    if (error) {
      alert(error.message);
      return;
    }

    const rows = (data as any[]) ?? [];
    const csv = toCSV(rows);

    const filename = `${upload?.campaign_name ?? "call_logs"}_${id}.csv`
      .replace(/[^\w\-]+/g, "_");

    downloadText(filename, csv);
  };

  if (!upload) return null;

  return (
    <div className="space-y-4">
      {/* Campaign Info */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <div>
            <b>Name:</b> {upload.campaign_name}
          </div>

          <div>
            <b>File:</b> {upload.filename ?? "—"}
          </div>

          <div className="flex gap-2 items-center">
            <b>Status:</b>
            <StatusBadge status={upload.status ?? "UNKNOWN"} />
          </div>

          <div>
            <b>Total rows (declared):</b> {upload.total_rows}
          </div>

          <div>
            <b>Contacts in DB:</b> {totalCount}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={exportReport} disabled={busy}>
              {busy ? "Exporting..." : "Export Report"}
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

      {/* Progress Section */}
      <Card>
        <CardHeader>
          <CardTitle>Progress by Status</CardTitle>
        </CardHeader>

        <CardContent className="grid md:grid-cols-3 gap-3">
          {counts
            .sort((a, b) =>
              a.current_status.localeCompare(b.current_status)
            )
            .map((x) => (
              <div
                key={x.current_status}
                className="p-3 rounded-lg border"
              >
                <div className="text-xs opacity-70">
                  {x.current_status}
                </div>
                <div className="text-2xl font-semibold">
                  {x.count}
                </div>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}