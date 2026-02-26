"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";

type Upload = {
  id: string;
  campaign_name: string;
  created_at: string;
  status: string;
};

type Stat = {
  total: number;
  available: number;
};

export default function TeleHome() {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [stats, setStats] = useState<Record<string, Stat>>({});

  const nowIso = () => new Date().toISOString();

  const load = async () => {
    const { data, error } = await supabase
      .from("uploads")
      .select("id,campaign_name,created_at,status")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    const rows = ((data as any) ?? []) as Upload[];
    setUploads(rows);

    // Load counts per upload (MVP: chạy N queries; campaign ít thì OK)
    const nextStats: Record<string, Stat> = {};

    await Promise.all(
      rows.map(async (u) => {
        // total
        const { count: totalCount } = await supabase
          .from("contacts")
          .select("id", { count: "exact", head: true })
          .eq("upload_id", u.id);

        // available to pull (khớp schema của bạn)
        const { count: availCount } = await supabase
          .from("contacts")
          .select("id", { count: "exact", head: true })
          .eq("upload_id", u.id)
          .not("current_status", "in", '("DONE","INVALID")')
          .or(`assigned_to.is.null,lease_expires_at.lt.${nowIso()}`);

        nextStats[u.id] = {
          total: totalCount ?? 0,
          available: availCount ?? 0,
        };
      })
    );

    setStats(nextStats);
  };

  useEffect(() => {
    load();
  }, []);

  const hasUploads = useMemo(() => uploads.length > 0, [uploads]);

  return (
    <div className="space-y-3">
      <div className="text-2xl font-semibold">Choose Campaign</div>

      {!hasUploads && (
        <div className="text-sm opacity-70">No campaigns found.</div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {uploads.map((u) => {
          const st = stats[u.id];
          return (
            <Link key={u.id} href={`/tele/campaign/${u.id}`}>
              <Card className="hover:shadow-md transition">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between gap-2">
                    <span className="truncate">{u.campaign_name}</span>
                    <StatusBadge status={u.status} />
                  </CardTitle>
                </CardHeader>

                <CardContent className="text-sm opacity-80 space-y-2">
                  <div>Created: {new Date(u.created_at).toLocaleString()}</div>

                  <div className="flex gap-3">
                    <div className="rounded-md border px-2 py-1">
                      <div className="text-xs opacity-70">Contacts</div>
                      <div className="font-semibold">{st ? st.total : "…"}</div>
                    </div>

                    <div className="rounded-md border px-2 py-1">
                      <div className="text-xs opacity-70">Available</div>
                      <div className="font-semibold">{st ? st.available : "…"}</div>
                    </div>
                  </div>

                  <div className="text-xs opacity-60">
                    Available = not DONE/INVALID and (unassigned or lease expired)
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}